/**
 * Configuration for model-skill-gate.
 *
 * Default location: ~/.pi/model-skill-gate.json (global, all sessions).
 * When the file does not exist the default example is written so the user can
 * edit it. Unknown keys are ignored; known keys with wrong types raise a
 * descriptive error (never a silent misconfiguration).
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface SkillSpec {
  /** Human-readable skill name shown in status/notices. */
  name: string;
  /** Directory containing SKILL.md (or a skills/ collection, or a .md file). */
  path: string;
}

export interface Rule {
  /** Model patterns: wildcard/exact, matched against provider/id and bare id. */
  match: string[];
  /** Catalog roots advertised when a model in `match` is active. */
  skills: SkillSpec[];
}

export interface GateConfig {
  rules: Rule[];
  /**
   * Extra catalog roots: directories scanned for sibling skills (one level
   * deep) whose name/description/location are advertised to gated models.
   * Combined with the per-rule `skills` roots.
   */
  indexDirs: string[];
  warn: {
    /** Notify when a session that started gated switches to a non-gated model. */
    onLeave: boolean;
    /** Notify when a non-gated session switches to a gated model. */
    onEnter: boolean;
  };
  /** Show a footer status indicator while a gated model is active. */
  statusBar: boolean;
}

export const DEFAULT_CONFIG_REL = join(".pi", "model-skill-gate.json");

export function defaultConfigPath(): string {
  return join(homedir(), DEFAULT_CONFIG_REL);
}

export function defaultConfig(): GateConfig {
  return {
    rules: [
      {
        match: ["*deepseek*"],
        skills: [
          {
            name: "superpowers",
            path: join(homedir(), ".pi", "gated-skills", "superpowers", "skills", "using-superpowers"),
          },
        ],
      },
    ],
    indexDirs: [join(homedir(), ".pi", "gated-skills", "superpowers", "skills")],
    warn: { onLeave: true, onEnter: true },
    statusBar: true,
  };
}

export function defaultConfigJson(): string {
  return JSON.stringify(defaultConfig(), null, 2) + "\n";
}

/** Replace all rules with exact model matches for the shared gated catalog. */
export function configWithSelectedModels(config: GateConfig, models: string[]): GateConfig {
  const uniqueModels = [...new Set(models)].sort((a, b) => a.localeCompare(b));
  const skills = config.rules.flatMap((rule) => rule.skills);
  const sourceSkills = skills.length > 0 ? skills : defaultConfig().rules.flatMap((rule) => rule.skills);
  const uniqueSkills = sourceSkills.filter(
    (skill, index) => sourceSkills.findIndex((candidate) => candidate.path === skill.path) === index,
  );
  return {
    ...config,
    rules: uniqueModels.length === 0 ? [] : [{ match: uniqueModels, skills: uniqueSkills }],
    indexDirs: [...config.indexDirs],
    warn: { ...config.warn },
  };
}

/** Persist a validated configuration atomically, preserving user-readable JSON. */
export function saveConfig(filePath: string, config: GateConfig): void {
  validateConfig(config, filePath);
  mkdirSync(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaryPath, JSON.stringify(config, null, 2) + "\n", "utf8");
    renameSync(temporaryPath, filePath);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    fail(`cannot write config to ${filePath}: ${message}`, filePath);
  }
}

export interface ConfigError extends Error {
  configPath?: string;
}

function fail(message: string, configPath?: string): never {
  const err = new Error(message) as ConfigError;
  if (configPath) err.configPath = configPath;
  throw err;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

/** Validate an unknown parsed value into a GateConfig; throws with field paths. */
export function validateConfig(value: unknown, source: string): GateConfig {
  if (typeof value !== "object" || value === null) {
    fail(`config must be a JSON object: ${source}`);
  }
  const raw = value as Record<string, unknown>;

  if (!Array.isArray(raw.rules)) fail(`"rules" must be an array: ${source}`);
  const rules: Rule[] = [];
  raw.rules.forEach((rule, i) => {
    if (typeof rule !== "object" || rule === null) {
      fail(`rules[${i}] must be an object: ${source}`);
    }
    const r = rule as Record<string, unknown>;
    if (!isStringArray(r.match) || (r.match as string[]).length === 0) {
      fail(`rules[${i}].match must be a non-empty array of strings: ${source}`);
    }
    if (!Array.isArray(r.skills)) fail(`rules[${i}].skills must be an array: ${source}`);
    const skills: SkillSpec[] = [];
    r.skills.forEach((skill, j) => {
      if (typeof skill !== "object" || skill === null) {
        fail(`rules[${i}].skills[${j}] must be an object: ${source}`);
      }
      const s = skill as Record<string, unknown>;
      if (typeof s.name !== "string" || s.name.length === 0) {
        fail(`rules[${i}].skills[${j}].name must be a non-empty string: ${source}`);
      }
      if (typeof s.path !== "string" || s.path.length === 0) {
        fail(`rules[${i}].skills[${j}].path must be a non-empty string: ${source}`);
      }
      skills.push({ name: s.name, path: s.path });
    });
    rules.push({ match: [...(r.match as string[])], skills });
  });

  const warnRaw = raw.warn;
  let warn: GateConfig["warn"];
  if (warnRaw === undefined) {
    warn = { onLeave: true, onEnter: true };
  } else if (typeof warnRaw === "object" && warnRaw !== null) {
    const w = warnRaw as Record<string, unknown>;
    if (w.onLeave !== undefined && typeof w.onLeave !== "boolean") {
      fail(`warn.onLeave must be a boolean: ${source}`);
    }
    if (w.onEnter !== undefined && typeof w.onEnter !== "boolean") {
      fail(`warn.onEnter must be a boolean: ${source}`);
    }
    warn = {
      onLeave: typeof w.onLeave === "boolean" ? w.onLeave : true,
      onEnter: typeof w.onEnter === "boolean" ? w.onEnter : true,
    };
  } else {
    fail(`"warn" must be an object: ${source}`);
  }

  const indexDirs = raw.indexDirs === undefined ? [] : raw.indexDirs;
  if (!isStringArray(indexDirs)) fail(`"indexDirs" must be an array of strings: ${source}`);
  if (raw.statusBar !== undefined && typeof raw.statusBar !== "boolean") {
    fail(`"statusBar" must be a boolean: ${source}`);
  }

  return {
    rules,
    indexDirs: [...indexDirs],
    warn,
    statusBar: typeof raw.statusBar === "boolean" ? raw.statusBar : true,
  };
}

/** Parse JSON text into a GateConfig, wrapping JSON errors with the source. */
export function parseConfig(raw: string, source: string): GateConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    fail(`invalid JSON in ${source}: ${message}`);
  }
  return validateConfig(parsed, source);
}

/**
 * Load config from `filePath`. When the file is missing, writes the default
 * example (creating parent dirs) and returns it with `wroteDefault: true`.
 */
export function loadConfig(filePath: string): { config: GateConfig; wroteDefault: boolean } {
  if (!existsSync(filePath)) {
    try {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, defaultConfigJson(), "utf8");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      fail(`cannot write default config to ${filePath}: ${message}`, filePath);
    }
    return { config: defaultConfig(), wroteDefault: true };
  }
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    fail(`cannot read config ${filePath}: ${message}`, filePath);
  }
  return { config: parseConfig(text, filePath), wroteDefault: false };
}
