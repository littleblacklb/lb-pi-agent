import { describe, expect, it } from "vitest";
import { enterMessage, evaluateSwitchWarnings, leaveMessage } from "./engine";

describe("evaluateSwitchWarnings", () => {
  const base = {
    notifiedLeave: false,
    notifiedEnter: false,
    warnOnLeave: true,
    warnOnEnter: true,
  };

  it("leave: started gated, current gated, switching to non-gated", () => {
    const r = evaluateSwitchWarnings({
      ...base,
      starterGated: true,
      prevGated: true,
      nextGated: false,
    });
    expect(r).toEqual({ leave: true, enter: false });
  });

  it("enter: started non-gated, current non-gated, switching to gated", () => {
    const r = evaluateSwitchWarnings({
      ...base,
      starterGated: false,
      prevGated: false,
      nextGated: true,
    });
    expect(r).toEqual({ leave: false, enter: true });
  });

  it("no warn when session started gated and stays gated", () => {
    const r = evaluateSwitchWarnings({
      ...base,
      starterGated: true,
      prevGated: false,
      nextGated: true,
    });
    expect(r.leave).toBe(false);
    expect(r.enter).toBe(false);
  });

  it("leave fires once per direction", () => {
    const once = evaluateSwitchWarnings({
      ...base,
      starterGated: true,
      prevGated: true,
      nextGated: false,
      notifiedLeave: true,
    });
    expect(once.leave).toBe(false);
  });

  it("enter respects warnOnEnter=false", () => {
    const r = evaluateSwitchWarnings({
      ...base,
      starterGated: false,
      prevGated: false,
      nextGated: true,
      warnOnEnter: false,
    });
    expect(r.enter).toBe(false);
  });

  it("leave respects warnOnLeave=false", () => {
    const r = evaluateSwitchWarnings({
      ...base,
      starterGated: true,
      prevGated: true,
      nextGated: false,
      warnOnLeave: false,
    });
    expect(r.leave).toBe(false);
  });

  it("leave requires a gated previous model (not just a gated starter)", () => {
    const r = evaluateSwitchWarnings({
      ...base,
      starterGated: true,
      prevGated: false,
      nextGated: false,
    });
    expect(r.leave).toBe(false);
  });
});

describe("visibility messages", () => {
  it("leaveMessage explains that skills are hidden for the next model", () => {
    const msg = leaveMessage("deepseek/deepseek-v4-pro", "openai-codex/gpt-5.6-sol");
    expect(msg).toContain("openai-codex/gpt-5.6-sol");
    expect(msg).toContain("deepseek/deepseek-v4-pro");
    expect(msg).toContain("隐藏");
    expect(msg).toContain("/new");
  });

  it("enterMessage explains that skills become available from the next turn", () => {
    const msg = enterMessage("openai-codex/gpt-5.6-sol", "deepseek/deepseek-v4-pro");
    expect(msg).toContain("deepseek/deepseek-v4-pro");
    expect(msg).toContain("openai-codex/gpt-5.6-sol");
    expect(msg).toContain("可按需加载");
    expect(msg).toContain("/new");
  });
});
