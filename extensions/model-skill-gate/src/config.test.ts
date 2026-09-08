import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  defaultConfig,
  defaultConfigPath,
  loadConfig,
  parseConfig,
  validateConfig,
} from "./config";

const tmpDirs: string[] = [];
function tmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "msg-config-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("validateConfig", () => {
  it("accepts a valid config and applies defaults", () => {
    const cfg = validateConfig(
      {
        rules: [
          { match: ["*deepseek*"], skills: [{ name: "superpowers", path: "/x/skills/using-superpowers" }] },
        ],
      },
      "test",
    );
    expect(cfg.rules).toHaveLength(1);
    expect(cfg.rules[0]!.skills[0]!.name).toBe("superpowers");
    expect(cfg.warn).toEqual({ onLeave: true, onEnter: true });
    expect(cfg.statusBar).toBe(true);
    expect(cfg.indexDirs).toEqual([]);
  });

  it("honors explicit warn and statusBar values", () => {
    const cfg = validateConfig(
      { rules: [{ match: ["x"], skills: [] }], warn: { onLeave: false }, statusBar: false },
      "test",
    );
    expect(cfg.warn.onLeave).toBe(false);
    expect(cfg.warn.onEnter).toBe(true);
    expect(cfg.statusBar).toBe(false);
  });

  it("rejects wrong rule shapes with a field path", () => {
    expect(() => validateConfig({}, "cfg")).toThrow(/rules.*array/);
    expect(() => validateConfig({ rules: [{}] }, "cfg")).toThrow(/rules\[0\]\.match/);
    expect(() => validateConfig({ rules: [{ match: [], skills: [] }] }, "cfg")).toThrow(
      /rules\[0\]\.match/,
    );
    expect(() => validateConfig({ rules: [{ match: ["a"], skills: "nope" }] }, "cfg")).toThrow(
      /rules\[0\]\.skills/,
    );
    expect(() =>
      validateConfig({ rules: [{ match: ["a"], skills: [{ name: "", path: "/x" }] }] }, "cfg"),
    ).toThrow(/skills\[0\]\.name/);
    expect(() =>
      validateConfig({ rules: [{ match: ["a"], skills: [{ name: "s", path: 5 }] }] }, "cfg"),
    ).toThrow(/skills\[0\]\.path/);
  });

  it("rejects wrong warn/indexDirs/statusBar types", () => {
    expect(() => validateConfig({ rules: [], warn: 3 }, "cfg")).toThrow(/"warn"/);
    expect(() => validateConfig({ rules: [], warn: { onLeave: "yes" } }, "cfg")).toThrow(
      /warn\.onLeave/,
    );
    expect(() => validateConfig({ rules: [], indexDirs: [1] }, "cfg")).toThrow(/indexDirs/);
    expect(() => validateConfig({ rules: [], statusBar: "y" }, "cfg")).toThrow(/statusBar/);
  });

  it("ignores unknown keys", () => {
    const cfg = validateConfig({ rules: [], extra: { whatever: 1 } }, "cfg");
    expect(cfg.rules).toEqual([]);
  });
});

describe("parseConfig", () => {
  it("parses valid JSON", () => {
    const cfg = parseConfig('{"rules":[{"match":["a"],"skills":[]}]}', "f.json");
    expect(cfg.rules[0]!.match).toEqual(["a"]);
  });

  it("wraps JSON errors with the source", () => {
    expect(() => parseConfig("{nope", "f.json")).toThrow(/invalid JSON in f\.json/);
  });
});

describe("loadConfig", () => {
  it("writes and returns the default example when missing", () => {
    const dir = tmpDir();
    const file = join(dir, "model-skill-gate.json");
    const { config, wroteDefault } = loadConfig(file);
    expect(wroteDefault).toBe(true);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0]!.match).toEqual(["*deepseek*"]);
    expect(existsSync(file)).toBe(true);
    const onDisk = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    expect(onDisk.rules).toBeDefined();
  });

  it("reads an existing valid config", () => {
    const dir = tmpDir();
    const file = join(dir, "msg.json");
    writeFileSync(file, JSON.stringify({ rules: [{ match: ["x/*"], skills: [] }], statusBar: false }), "utf8");
    const { config, wroteDefault } = loadConfig(file);
    expect(wroteDefault).toBe(false);
    expect(config.rules[0]!.match).toEqual(["x/*"]);
    expect(config.statusBar).toBe(false);
  });

  it("surfaces invalid JSON with the file path", () => {
    const dir = tmpDir();
    const file = join(dir, "bad.json");
    writeFileSync(file, "{oops", "utf8");
    expect(() => loadConfig(file)).toThrow(/bad\.json/);
  });
});

describe("defaults", () => {
  it("default config targets the deepseek family and a private superpowers clone", () => {
    const cfg = defaultConfig();
    expect(cfg.rules[0]!.match).toContain("*deepseek*");
    expect(cfg.rules[0]!.skills[0]!.name).toBe("superpowers");
    expect(cfg.rules[0]!.skills[0]!.path).toContain(join(".pi", "gated-skills", "superpowers"));
    expect(defaultConfigPath()).toContain(join(".pi", "model-skill-gate.json"));
  });
});
