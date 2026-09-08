import { describe, expect, it } from "vitest";
import { configWithSelectedModels, defaultConfig } from "./config";
import { modelKey, moveCursor } from "./model-picker";

describe("model picker state", () => {
  it("moves around a two-column model grid without escaping bounds", () => {
    expect(moveCursor(0, "right", 5, 2)).toBe(1);
    expect(moveCursor(1, "down", 5, 2)).toBe(3);
    expect(moveCursor(3, "down", 5, 2)).toBe(4);
    expect(moveCursor(4, "right", 5, 2)).toBe(4);
    expect(moveCursor(4, "up", 5, 2)).toBe(2);
    expect(moveCursor(0, "left", 5, 2)).toBe(0);
  });

  it("uses exact provider/model identifiers for persisted selection", () => {
    expect(modelKey({ provider: "openai", id: "gpt-5.6" })).toBe("openai/gpt-5.6");
  });
});

describe("configWithSelectedModels", () => {
  it("replaces model matching with exact selected models and retains the skill sources", () => {
    const config = configWithSelectedModels(defaultConfig(), ["openai/gpt-5.6", "deepseek/deepseek-v4-pro"]);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0]?.match).toEqual(["deepseek/deepseek-v4-pro", "openai/gpt-5.6"]);
    expect(config.rules[0]?.skills).toEqual(defaultConfig().rules[0]?.skills);
  });

  it("keeps a reusable skill source after all models are deselected", () => {
    const config = configWithSelectedModels(defaultConfig(), []);
    expect(config.rules).toEqual([]);
    const restored = configWithSelectedModels(config, ["openai/gpt-5.6"]);
    expect(restored.rules[0]?.skills).toEqual(defaultConfig().rules[0]?.skills);
  });
});
