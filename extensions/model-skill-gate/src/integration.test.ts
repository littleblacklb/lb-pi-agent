import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "./config";
import { ModelSkillGate } from "./index";

const realSkillsDir = join(homedir(), ".pi", "gated-skills", "superpowers", "skills");
const hasRealClone = existsSync(join(realSkillsDir, "using-superpowers", "SKILL.md"));

describe.skipIf(!hasRealClone)("real superpowers clone integration", () => {
  it("advertises the real skill catalog to deepseek models", () => {
    const gate = new ModelSkillGate("/nonexistent/model-skill-gate.json"); // falls back to defaults
    const cfg = gate.config();
    expect(cfg).toEqual(defaultConfig());

    const deepseek = { provider: "deepseek", id: "deepseek-v4-pro" };
    const outcome = gate.outcome(deepseek);
    expect(outcome.gated).toBe(true);
    expect(outcome.label).toBe("superpowers");
    expect(outcome.catalog).not.toBeNull();

    const catalog = outcome.catalog!;
    // using-superpowers itself + one-level sibling skills are advertised
    const locations = new Set(catalog.map((e) => e.location));
    expect(locations.has(join(realSkillsDir, "using-superpowers", "SKILL.md"))).toBe(true);
    expect(locations.has(join(realSkillsDir, "brainstorming", "SKILL.md"))).toBe(true);
    expect(locations.has(join(realSkillsDir, "test-driven-development", "SKILL.md"))).toBe(true);
    expect(catalog.length).toBeGreaterThan(10);

    // every entry has a real file, a name, and a non-empty description
    for (const entry of catalog) {
      expect(existsSync(entry.location)).toBe(true);
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it("does not gate non-superpowers models", () => {
    const gate = new ModelSkillGate("/nonexistent/model-skill-gate.json");
    const outcome = gate.outcome({ provider: "openai-codex", id: "gpt-5.6-sol" });
    expect(outcome.gated).toBe(false);
    expect(outcome.catalog).toBeNull();
  });

  it("gates any model id containing deepseek regardless of provider", () => {
    const gate = new ModelSkillGate("/nonexistent/model-skill-gate.json");
    expect(gate.outcome({ provider: "anyrouter", id: "deepseek-r1-0528" }).gated).toBe(true);
  });
});
