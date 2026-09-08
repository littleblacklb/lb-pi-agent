/**
 * model-skill-gate entry point.
 *
 * Skill VISIBILITY gate by model, using pi's own skill mechanism:
 *
 * - Superpowers skills live in a private clone outside pi's scan locations
 *   (`~/.pi/gated-skills/superpowers`), so no model sees them natively.
 * - On every user turn (`before_agent_start`) a gated model (matching the
 *   configured rules, e.g. `*deepseek*`) gets their catalog entries merged
 *   into the system prompt as native <available_skills> entries
 *   (name/description/SKILL.md location). The model reads a SKILL.md on
 *   demand when a task matches — nothing is auto-loaded.
 * - Non-gated models get the pristine base prompt (pi resets the override
 *   automatically when the handler returns undefined), so gpt-5.6 etc. never
 *   see the gated skills.
 *
 * Model switching (`model_select`) triggers symmetric availability notices
 * (once per session and direction), and the footer status shows ⚡ while a
 * gated model is active.
 */

import { appendFileSync, statSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  defaultConfig,
  defaultConfigPath,
  configWithSelectedModels,
  loadConfig,
  saveConfig,
  type GateConfig,
  type Rule,
  type SkillSpec,
} from "./config";
import { modelMatches, type ModelRef } from "./matcher";
import { buildCatalog, expandPath, injectCatalog, type CatalogEntry } from "./catalog";
import { enterMessage, evaluateSwitchWarnings, leaveMessage } from "./engine";
import { ModelSkillPicker, modelKey, type PickerModel } from "./model-picker";

const DEBUG = process.env.PI_MODEL_SKILL_GATE_DEBUG === "1";
const LOG_FILE = process.env.PI_MODEL_SKILL_GATE_LOG ?? "";

function dbg(...args: unknown[]): void {
  if (DEBUG) console.log("[model-skill-gate]", ...args);
}

/** Optional deterministic log (used by E2E tests instead of scraping the TUI). */
function logEvent(line: string): void {
  if (LOG_FILE) {
    try {
      appendFileSync(LOG_FILE, `${new Date().toISOString()} ${line}\n`, "utf8");
    } catch {
      // Logging must never break the gate.
    }
  }
}

function fmt(m: ModelRef): string {
  return `${m.provider}/${m.id}`;
}

export interface GateOutcome {
  gated: boolean;
  /** Skill display names for the active rule, e.g. "superpowers". */
  label: string;
  /** Catalog entries advertised to this model, or null when not gated/loadable. */
  catalog: CatalogEntry[] | null;
}

/** Config + catalog caches; config auto-reloads when its mtime changes. */
export class ModelSkillGate {
  readonly configPath: string;
  private cfgCache: { config: GateConfig; mtimeMs: number } | null = null;
  private lastGood: GateConfig | null = null;
  private warnedConfig: Set<string> = new Set();
  private warnedCatalog: Set<string> = new Set();
  /** Set when the last config load failed; surfaced once per process. */
  lastProblem: string | null = null;

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  /** Runtime-only caches reset (used by the reload command). */
  clearRuntimeCaches(): void {
    this.cfgCache = null;
    this.warnedConfig.clear();
    this.warnedCatalog.clear();
  }

  config(): GateConfig {
    let mtime = -1;
    try {
      mtime = statSync(this.configPath).mtimeMs;
    } catch {
      // Missing/unreadable: handled below.
    }
    if (this.cfgCache && this.cfgCache.mtimeMs === mtime) return this.cfgCache.config;

    if (mtime < 0) {
      this.recordProblem(
        `config ${this.configPath} is not readable; using built-in defaults`,
        String(mtime),
      );
      const cfg = defaultConfig();
      this.cfgCache = { config: cfg, mtimeMs: mtime };
      return cfg;
    }
    try {
      const { config } = loadConfig(this.configPath);
      this.cfgCache = { config, mtimeMs: mtime };
      this.lastGood = config;
      this.lastProblem = null;
      return config;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.recordProblem(message, String(mtime));
      const fallback = this.lastGood ?? defaultConfig();
      this.cfgCache = { config: fallback, mtimeMs: mtime };
      return fallback;
    }
  }

  private recordProblem(message: string, key: string): void {
    this.lastProblem = message;
    if (!this.warnedConfig.has(key)) {
      this.warnedConfig.add(key);
      console.error(`[model-skill-gate] ${message}`);
    }
  }

  /** All rules matching the model. */
  matchedRules(model: ModelRef): Rule[] {
    return this.config().rules.filter((rule) => modelMatches(model, rule.match));
  }

  isGated(model: ModelRef): boolean {
    return this.matchedRules(model).length > 0;
  }

  /** Resolve the gate outcome for a model: gated?, label, advertised catalog. */
  outcome(model: ModelRef): GateOutcome {
    const cfg = this.config();
    const rules = this.matchedRules(model);
    if (rules.length === 0) return { gated: false, label: "", catalog: null };

    const seen = new Set<string>();
    const sources: string[] = [];
    const names: string[] = [];
    for (const rule of rules) {
      for (const spec of rule.skills) {
        const key = expandPath(spec.path);
        if (seen.has(key)) continue;
        seen.add(key);
        sources.push(spec.path);
        names.push(spec.name);
      }
    }
    for (const dir of cfg.indexDirs) {
      const key = expandPath(dir);
      if (!seen.has(key)) {
        seen.add(key);
        sources.push(dir);
      }
    }

    const catalog = buildCatalog(sources);
    if (catalog.length === 0) {
      const problem =
        `model ${fmt(model)} matched rules but no skill catalog could be built ` +
        `from ${sources.join(", ")}; gate disabled for this model`;
      if (!this.warnedCatalog.has(problem)) {
        this.warnedCatalog.add(problem);
        console.error(`[model-skill-gate] ${problem}`);
      }
      return { gated: false, label: "", catalog: null };
    }
    return { gated: true, label: names.join(", "), catalog };
  }
}

/** Per-session warning/tracking state. */
interface SessionGateState {
  sessionId: string;
  /** Model that led the session (first chat model, or last pre-chat selection). */
  starter: ModelRef | null;
  /** Whether any LLM call happened in this session yet. */
  contextSeen: boolean;
  /** Gated state of the current model (null until known). */
  lastGated: boolean | null;
  notifiedLeave: boolean;
  notifiedEnter: boolean;
}

function freshSession(sessionId: string): SessionGateState {
  return {
    sessionId,
    starter: null,
    contextSeen: false,
    lastGated: null,
    notifiedLeave: false,
    notifiedEnter: false,
  };
}

const STATUS_KEY = "model-skill-gate";

/** Minimal shape of the context surface this extension uses. */
interface UiCtx {
  hasUI?: boolean;
  ui?: {
    setStatus(key: string, value: string | undefined): void;
    notify(message: string, type: "info" | "warning" | "error"): void;
  };
}

export default function (pi: ExtensionAPI) {
  const configPath = process.env.PI_MODEL_SKILL_GATE_CONFIG ?? defaultConfigPath();
  const gate = new ModelSkillGate(configPath);
  let session: SessionGateState = freshSession("");
  let statusShown = false;
  let problemNotified = false;

  const syncStatus = (ctx: UiCtx, outcome: GateOutcome): void => {
    if (!ctx.hasUI || !gate.config().statusBar) return;
    if (statusShown === outcome.gated) return;
    statusShown = outcome.gated;
    if (outcome.gated) {
      ctx.ui?.setStatus(STATUS_KEY, `⚡ ${outcome.label || "gated skills"}`);
    } else {
      ctx.ui?.setStatus(STATUS_KEY, undefined);
    }
  };

  const sessionIdOf = (ctx: { sessionManager?: { getSessionId(): string } }): string =>
    ctx.sessionManager?.getSessionId() ?? "";

  const warn = (ctx: UiCtx, message: string): void => {
    logEvent(`warn: ${message}`);
    if (ctx.hasUI) {
      ctx.ui?.notify(message, "warning");
    } else {
      console.log(`[model-skill-gate] ${message}`);
    }
  };

  pi.on("session_start", async (_event, ctx) => {
    session = freshSession(sessionIdOf(ctx as never));
    statusShown = false;
    dbg("session_start", session.sessionId, "rules:", gate.config().rules.length);
    if (gate.lastProblem && !problemNotified) {
      problemNotified = true;
      const message = `model-skill-gate 配置错误，已回退默认规则: ${gate.lastProblem}`;
      if (ctx.hasUI) ctx.ui?.notify(message, "error");
      else console.error(`[model-skill-gate] ${message}`);
    }
    if (ctx.hasUI) ctx.ui?.setStatus(STATUS_KEY, undefined);
  });

  pi.on("before_agent_start", async (event, ctx) => {
    try {
      const model: ModelRef | undefined = ctx.model
        ? { provider: ctx.model.provider, id: ctx.model.id }
        : undefined;
      const outcome: GateOutcome = model
        ? gate.outcome(model)
        : { gated: false, label: "", catalog: null };

      // Non-gated (or unknown model): return nothing so pi uses the pristine
      // base prompt — superpowers stays invisible.
      if (!model || !outcome.gated || !outcome.catalog) return undefined;

      const result = injectCatalog(event.systemPrompt, outcome.catalog);
      logEvent(
        `bas ${fmt(model)} gated=true entries=${outcome.catalog.length} inserted=${result.inserted} existing=${result.existing} promptLen=${result.prompt.length}`,
      );
      dbg("before_agent_start", fmt(model), "catalog entries:", result.inserted);
      // All entries already present in the base prompt (user installed them
      // natively): nothing to gate, keep the base prompt untouched.
      if (result.inserted === 0) return undefined;
      return { systemPrompt: result.prompt };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[model-skill-gate] before_agent_start handler failed: ${message}`);
      return undefined;
    }
  });

  pi.on("model_select", async (event, ctx) => {
    try {
      const model: ModelRef = { provider: event.model.provider, id: event.model.id };
      const sid = sessionIdOf(ctx as never);
      if (sid && sid !== session.sessionId) {
        session = freshSession(sid);
      }
      dbg("model_select", event.source, fmt(model), "contextSeen:", session.contextSeen);

      const nextGated = gate.isGated(model);
      const outcome: GateOutcome = gate.outcome(model);
      const cfg = gate.config();

      if (!session.contextSeen) {
        // Pre-chat selection (including restore at startup) defines the starter.
        session.starter = model;
        session.lastGated = nextGated;
        syncStatus(ctx as UiCtx, outcome);
        return;
      }

      // Chat has happened; only user-initiated switches warn (restore is not).
      if (event.source === "restore") {
        session.lastGated = nextGated;
        syncStatus(ctx as UiCtx, outcome);
        return;
      }

      const starterGated = session.starter ? gate.isGated(session.starter) : false;
      const prevGated = session.lastGated ?? starterGated;
      const { leave, enter } = evaluateSwitchWarnings({
        starterGated,
        prevGated,
        nextGated,
        notifiedLeave: session.notifiedLeave,
        notifiedEnter: session.notifiedEnter,
        warnOnLeave: cfg.warn.onLeave,
        warnOnEnter: cfg.warn.onEnter,
      });

      if (leave) {
        session.notifiedLeave = true;
        const starterLabel = session.starter ? fmt(session.starter) : "unknown";
        logEvent(
          `model_select ${event.source} starterGated=${starterGated} prevGated=${prevGated} nextGated=${nextGated} leave=true enter=false prev=${starterLabel} next=${fmt(model)}`,
        );
        warn(ctx as UiCtx, leaveMessage(starterLabel, fmt(model)));
      } else if (enter) {
        session.notifiedEnter = true;
        const starterLabel = session.starter ? fmt(session.starter) : "unknown";
        logEvent(
          `model_select ${event.source} starterGated=${starterGated} prevGated=${prevGated} nextGated=${nextGated} leave=false enter=true prev=${starterLabel} next=${fmt(model)}`,
        );
        warn(ctx as UiCtx, enterMessage(starterLabel, fmt(model)));
      } else {
        logEvent(
          `model_select ${event.source} starterGated=${starterGated} prevGated=${prevGated} nextGated=${nextGated} leave=false enter=false next=${fmt(model)}`,
        );
      }

      session.lastGated = nextGated;
      syncStatus(ctx as UiCtx, outcome);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[model-skill-gate] model_select handler failed: ${message}`);
    }
  });

  // Tracking only: remembers the session's starter model and keeps the
  // footer status in sync with the running model.
  pi.on("context", async (event, ctx) => {
    try {
      const model: ModelRef | undefined = ctx.model
        ? { provider: ctx.model.provider, id: ctx.model.id }
        : undefined;
      const outcome: GateOutcome = model
        ? gate.outcome(model)
        : { gated: false, label: "", catalog: null };

      if (model) {
        if (!session.starter) session.starter = model;
        session.contextSeen = true;
        session.lastGated = outcome.gated;
      }

      logEvent(
        `context ${model ? fmt(model) : "no-model"} gated=${outcome.gated} catalog=${outcome.catalog ? outcome.catalog.length : 0}`,
      );
      dbg(
        "context",
        model ? fmt(model) : "no-model",
        "gated:",
        outcome.gated,
        "starter:",
        session.starter ? fmt(session.starter) : "-",
      );

      syncStatus(ctx as UiCtx, outcome);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[model-skill-gate] context handler failed: ${message}`);
    }
  });

  pi.registerCommand("skill-gate", {
    description:
      "Show model-skill-gate status; run `/skill-gate models` to choose Superpowers-enabled models or `/skill-gate reload` to reset runtime caches",
    handler: async (args, ctx) => {
      try {
        const arg = (args ?? "").trim().toLowerCase();
        if (arg === "reload") {
          gate.clearRuntimeCaches();
          session = freshSession(sessionIdOf(ctx as never));
          statusShown = false;
          if (ctx.hasUI) ctx.ui.notify("model-skill-gate runtime caches reloaded", "info");
          return;
        }

        if (arg === "models") {
          if (ctx.mode !== "tui") {
            const message = "model picker requires interactive TUI mode; edit the config or run pi interactively";
            console.error(`[model-skill-gate] ${message}`);
            if (ctx.hasUI) ctx.ui.notify(message, "warning");
            return;
          }

          const models: PickerModel[] = ctx.modelRegistry
            .getAvailable()
            .map((model) => ({ provider: model.provider, id: model.id, name: model.name }))
            .sort((a, b) => modelKey(a).localeCompare(modelKey(b)));
          if (models.length === 0) {
            ctx.ui.notify("No available models found. Configure a provider first.", "warning");
            return;
          }

          const selected = models.filter((model) => gate.isGated(model)).map(modelKey);
          const result = await ctx.ui.custom<import("./model-picker").PickerResult>(
            (tui, theme, _keybindings, done) =>
              new ModelSkillPicker(tui, theme, models, selected, done),
            { overlay: true, overlayOptions: { anchor: "center", width: "82%", minWidth: 42, maxHeight: "82%" } },
          );
          if (!result.save) {
            ctx.ui.notify("Superpowers model access unchanged", "info");
            return;
          }

          const nextConfig = configWithSelectedModels(gate.config(), [...result.selected]);
          saveConfig(configPath, nextConfig);
          gate.clearRuntimeCaches();
          const outcome = ctx.model
            ? gate.outcome({ provider: ctx.model.provider, id: ctx.model.id })
            : { gated: false, label: "", catalog: null };
          statusShown = !outcome.gated;
          syncStatus(ctx as UiCtx, outcome);
          const message = `Superpowers access saved for ${result.selected.size} model${result.selected.size === 1 ? "" : "s"}`;
          logEvent(`command /skill-gate models: selected=${[...result.selected].join(",")}`);
          ctx.ui.notify(message, "info");
          return;
        }

        const cfg = gate.config();
        const model: ModelRef | undefined = ctx.model
          ? { provider: ctx.model.provider, id: ctx.model.id }
          : undefined;
        const current = model ? gate.outcome(model) : { gated: false, label: "", catalog: null as CatalogEntry[] | null };
        const starterLabel = session.starter
          ? `${fmt(session.starter)}${gate.isGated(session.starter) ? " (gated)" : ""}`
          : "unknown";
        const lines = [
          `config: ${configPath}`,
          `model: ${model ? fmt(model) : "unknown"}`,
          `starter: ${starterLabel}`,
          `gate: ${current.gated ? `ON (${current.label}, ${current.catalog?.length ?? 0} skills visible)` : "OFF"}`,
          `warn: leave=${cfg.warn.onLeave ? "on" : "off"} enter=${cfg.warn.onEnter ? "on" : "off"} statusBar=${cfg.statusBar ? "on" : "off"}`,
          ...cfg.rules.map((rule, i) => `rule ${i + 1}: match ${rule.match.join(", ")} → ${rule.skills.map((s) => s.name).join(", ") || "(no skills)"}`),
        ];
        logEvent(`command /skill-gate: ${lines.join(" | ")}`);
        console.log(`[model-skill-gate] status\n${lines.join("\n")}`);
        if (ctx.hasUI) {
          ctx.ui.notify(
            `model-skill-gate: ${current.gated ? `⚡ ${current.label} 生效中（${current.catalog?.length ?? 0} skills）` : "未生效"} | starter ${starterLabel} | ${lines.slice(4).join(" | ")}`,
            "info",
          );
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`[model-skill-gate] /skill-gate failed: ${message}`);
      }
    },
  });
}
