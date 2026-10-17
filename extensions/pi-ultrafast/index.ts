import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createPiFastModeExtension } from "../../npm/node_modules/pi-openai-fast-mode/src/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const targets = new Set(["gpt-6-astra", "gpt-6.1-sol"]);
export function supports(model: { provider: string; id: string } | undefined) {
  return !!model && ["openai", "openai-codex"].includes(model.provider) && targets.has(model.id);
}

export function createUltrafastExtension(statePath = join(here, "config.json"), agentDir?: string) {
  return function (pi: ExtensionAPI) {
    let enabled = false;
    function status(ctx: ExtensionContext) {
      if (ctx.hasUI) ctx.ui.setStatus("ultrafast", enabled
        ? (supports(ctx.model) ? "ultrafast (overrides fast)" : "ultrafast (inactive: unsupported model)")
        : undefined);
    }
    async function save(next: boolean) {
      await mkdir(dirname(statePath), { recursive: true });
      const temp = `${statePath}.${process.pid}.tmp`;
      await writeFile(temp, JSON.stringify({ enabled: next }, null, 2) + "\n", { mode: 0o600 });
      await rename(temp, statePath);
      enabled = next;
    }
    // Wrap the existing payload hook so priority cannot overwrite ultrafast,
    // regardless of other extension load order. All other Fast behavior stays intact.
    const wrapped = new Proxy(pi, {
      get(target, prop) {
        if (prop !== "on") return Reflect.get(target, prop);
        return (event: string, handler: (...args: any[]) => any) => {
          if (event !== "before_provider_request") return target.on(event as any, handler);
          return target.on("before_provider_request", async (event, ctx) => {
            const original = await handler(event, ctx);
            const payload = original ?? event.payload;
            if (!enabled || !supports(ctx.model) || !payload || typeof payload !== "object" || Array.isArray(payload)) return original;
            return { ...payload, service_tier: "ultrafast" };
          });
        };
      },
    });
    createPiFastModeExtension({ agentDir })(wrapped);

    pi.on("session_start", async (_event, ctx) => {
      enabled = false;
      try {
        const config = JSON.parse(await readFile(statePath, "utf8"));
        if (typeof config.enabled !== "boolean") throw new Error("Invalid enabled value");
        enabled = config.enabled;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT" && ctx.hasUI)
          ctx.ui.notify("Ultrafast config could not be read; disabled. Use /ultrafast on to reset it.", "warning");
      }
      status(ctx);
    });
    pi.on("model_select", (_event, ctx) => status(ctx));
    pi.on("session_shutdown", (_event, ctx) => {
      if (ctx.hasUI) ctx.ui.setStatus("ultrafast", undefined);
    });
    pi.registerCommand("ultrafast", {
      description: "Ultrafast tier (higher usage): /ultrafast [on|off|toggle|status]. Overrides /fast while enabled.",
      getArgumentCompletions: (prefix) => ["on", "off", "toggle", "status"].filter(x => x.startsWith(prefix)).map(value => ({ value, label: value })),
      handler: async (args, ctx) => {
        const action = args.trim().toLowerCase() || "toggle";
        if (!["on", "off", "toggle", "status"].includes(action)) {
          if (ctx.hasUI) ctx.ui.notify("Usage: /ultrafast [on|off|toggle|status]", "warning");
          return;
        }
        try {
          if (action !== "status") await save(action === "on" || (action === "toggle" && !enabled));
          status(ctx);
          if (ctx.hasUI) ctx.ui.notify(`Ultrafast ${enabled ? "ON (higher usage; overrides /fast)" : "OFF (existing /fast setting applies)"}${enabled && !supports(ctx.model) ? "; inactive for this model" : ""}.`, "info");
        } catch {
          if (ctx.hasUI) ctx.ui.notify("Could not save Ultrafast state; setting unchanged.", "error");
        }
      },
    });
  };
}

export default createUltrafastExtension();
