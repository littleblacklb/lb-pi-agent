import { createJiti } from "/Users/lb/.pi/agent/npm/node_modules/jiti/lib/jiti.mjs";
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  alias: { "@earendil-works/pi-tui": "/tmp/stub-pi-tui.mjs" },
});
const settings = await jiti.import("/Users/lb/.pi/agent/npm/node_modules/@pi-unipi/notify/settings.ts");
const cfg = settings.loadConfig();
console.log("-- effective merged config --");
console.log(JSON.stringify({ events: cfg.events, recap: cfg.recap, silenceAfterInput: cfg.silenceAfterInput, native: cfg.native, defaultPlatforms: cfg.defaultPlatforms }, null, 2));
console.log("\n-- checks --");
const checks = [
  ["ask_user_prompt.enabled", cfg.events.ask_user_prompt?.enabled === true],
  ["agent_settled.enabled", cfg.events.agent_settled?.enabled === true],
  ["agent_end stays off", cfg.events.agent_end?.enabled === false],
  ["mcp_server_error stays on", cfg.events.mcp_server_error?.enabled === true],
  ["permission_request enabled (agent blocked on a permission dialog)", cfg.events.permission_request?.enabled === true],
  ["recap.enabled", cfg.recap.enabled === true],
  ["recap.model", cfg.recap.model === "deepseek/deepseek-flash"],
  ["silence.enabled=false (deliberate: keypress window swallows away-from-terminal notifications)", cfg.silenceAfterInput.enabled === false],
  ["silence.windowMs=120000 (inert while disabled)", cfg.silenceAfterInput.windowMs === 120000],
  ["silence.platforms=[native] (inert while disabled)", JSON.stringify(cfg.silenceAfterInput.platforms) === JSON.stringify(["native"])],
  ["native.enabled", cfg.native.enabled === true],
  ["defaultPlatforms=[native]", JSON.stringify(cfg.defaultPlatforms) === JSON.stringify(["native"])],
];
let ok = true;
for (const [name, pass] of checks) { if (!pass) ok = false; console.log(`${pass ? "PASS" : "FAIL"}  ${name}`); }
console.log(ok ? "\nALL CHECKS PASS" : "\nCHECKS FAILED");
process.exit(ok ? 0 : 1);
