import { describe, expect, it } from "vitest";
import { globToRegExpSource, hasGlob, matchPattern, modelMatches } from "./matcher";

describe("hasGlob", () => {
  it("detects glob syntax", () => {
    expect(hasGlob("deepseek/*")).toBe(true);
    expect(hasGlob("*deepseek*")).toBe(true);
    expect(hasGlob("deepseek-v4-pro")).toBe(false);
  });
});

describe("matchPattern", () => {
  it("handles plain globs", () => {
    expect(matchPattern("*deepseek*", "deepseek-v4-pro")).toBe(true);
    expect(matchPattern("*deepseek*", "deepseek/deepseek-v4-pro")).toBe(true);
    expect(matchPattern("*deepseek*", "gpt-5.6-sol")).toBe(false);
    expect(matchPattern("deepseek/*", "deepseek/deepseek-v4-pro")).toBe(true);
    expect(matchPattern("deepseek/*", "deepseek-v4-pro")).toBe(false);
    expect(matchPattern("gpt-5.6*", "gpt-5.6-sol")).toBe(true);
    expect(matchPattern("gpt-5.6?", "gpt-5.6x")).toBe(true);
    expect(matchPattern("gpt-[56]*", "gpt-5.6-sol")).toBe(true);
    expect(matchPattern("gpt-[56]*", "gpt-7")).toBe(false);
  });

  it("treats patterns without globs as exact matches", () => {
    expect(matchPattern("deepseek-v4-pro", "deepseek-v4-pro")).toBe(true);
    expect(matchPattern("deepseek/deepseek-v4-pro", "deepseek/deepseek-v4-pro")).toBe(true);
    expect(matchPattern("deepseek-v4-pro", "deepseek-v4-prox")).toBe(false);
  });

  it("escapes regex metacharacters in literal patterns", () => {
    expect(matchPattern("gpt.5", "gptx5")).toBe(false);
    expect(matchPattern("gpt.5", "gpt.5")).toBe(true);
    expect(matchPattern("gpt+5", "gpt5")).toBe(false);
  });

  it("keeps anchored semantics", () => {
    expect(matchPattern("*deepseek*", "my-deepseek-tool")).toBe(true);
    expect(matchPattern("deepseek", "deepseek-v4-pro")).toBe(false); // exact, not prefix
  });
});

describe("globToRegExpSource", () => {
  it("produces a compilable anchored source", () => {
    expect(() => new RegExp("^" + globToRegExpSource("deepseek/*") + "$")).not.toThrow();
    expect(new RegExp("^" + globToRegExpSource("a.*b?c[d-f]") + "$").test("a.xbQcd")).toBe(true);
  });
});

describe("modelMatches", () => {
  const deepseek = { provider: "deepseek", id: "deepseek-v4-pro" };
  const gpt = { provider: "openai-codex", id: "gpt-5.6-sol" };

  it("matches the deepseek family with a single wildcard pattern", () => {
    expect(modelMatches(deepseek, ["*deepseek*"])).toBe(true);
    expect(modelMatches(gpt, ["*deepseek*"])).toBe(false);
  });

  it("matches by provider prefix", () => {
    expect(modelMatches(deepseek, ["deepseek/*"])).toBe(true);
    expect(modelMatches({ provider: "deepseek", id: "anything" }, ["deepseek/*"])).toBe(true);
    expect(modelMatches(gpt, ["deepseek/*"])).toBe(false);
  });

  it("matches bare ids across providers", () => {
    expect(
      modelMatches({ provider: "anyrouter", id: "deepseek-r1" }, ["*deepseek*"]),
    ).toBe(true);
    expect(modelMatches({ provider: "anyrouter", id: "deepseek-r1" }, ["deepseek-r1"])).toBe(
      true,
    );
  });

  it("matches exact qualified ids only when specified", () => {
    expect(modelMatches(deepseek, ["deepseek/deepseek-v4-pro"])).toBe(true);
    expect(modelMatches({ provider: "anyrouter", id: "deepseek-v4-pro" }, ["deepseek/deepseek-v4-pro"])).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(modelMatches({ provider: "DeepSeek", id: "DeepSeek-V4-Pro" }, ["*deepseek*"])).toBe(
      true,
    );
    expect(modelMatches(deepseek, ["DEEPSEEK/*"])).toBe(true);
  });

  it("matches any pattern in the rule list", () => {
    expect(modelMatches(gpt, ["*deepseek*", "gpt-5.6*"])).toBe(true);
    expect(modelMatches(deepseek, ["gpt-5.6*", "deepseek/*"])).toBe(true);
    expect(modelMatches(gpt, ["*deepseek*", "deepseek/*"])).toBe(false);
  });

  it("returns false for empty rules", () => {
    expect(modelMatches(gpt, [])).toBe(false);
    expect(modelMatches(deepseek, [])).toBe(false);
  });
});
