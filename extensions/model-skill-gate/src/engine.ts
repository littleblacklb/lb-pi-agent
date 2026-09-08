/**
 * Warning evaluation for model-skill-gate (visibility mode).
 *
 * Since skills are now only advertised (not auto-injected), a model switch
 * does not "pollute" a context — it just changes what the current model can
 * see. Notifications are still useful and stay symmetric and once-per-
 * session-and-direction:
 * - leave: session started on a gated model, session switches away → the
 *   superpowers skills disappear for the current model.
 * - enter: session did not start gated, session switches to a gated model →
 *   the skills become available from the next turn on.
 */

export function evaluateSwitchWarnings(input: {
  starterGated: boolean;
  prevGated: boolean;
  nextGated: boolean;
  notifiedLeave: boolean;
  notifiedEnter: boolean;
  warnOnLeave: boolean;
  warnOnEnter: boolean;
}): { leave: boolean; enter: boolean } {
  const leave =
    input.warnOnLeave &&
    input.starterGated &&
    input.prevGated &&
    !input.nextGated &&
    !input.notifiedLeave;
  const enter =
    input.warnOnEnter &&
    !input.starterGated &&
    !input.prevGated &&
    input.nextGated &&
    !input.notifiedEnter;
  return { leave, enter };
}

/** Notify copy when a session that started gated switches to a non-gated model. */
export function leaveMessage(starterLabel: string, nextLabel: string): string {
  return (
    `已切到 ${nextLabel}：不在 superpowers 启用规则内，技能已对本模型隐藏。` +
    `本会话早前内容由 ${starterLabel} 会话生成，如需纯净会话请 /new 开新会话。`
  );
}

/** Notify copy when a non-gated session switches to a gated model. */
export function enterMessage(starterLabel: string, nextLabel: string): string {
  return (
    `已切到 ${nextLabel}：命中 superpowers 启用规则，技能自下一轮提问起可按需加载。` +
    `本会话早前内容由 ${starterLabel} 会话生成，如需纯净会话请 /new 开新会话。`
  );
}
