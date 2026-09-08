# Plan: fix global prompt files (AGENTS.md + APPEND_SYSTEM.md)

Status: **decisions locked, awaiting implementation permit** — no changes made yet.
Date: 2026-09-09
Scope: `~/.pi/agent/AGENTS.md`, `~/.pi/agent/APPEND_SYSTEM.md`, new `~/.unipi/config/notify/config.json`
Out of scope: project `AGENTS.md`, installed extensions, session history.

## 0. Corrected evidence (earlier verdict was wrong)

The two files were created 2026-09-03 19:13 CST (= 11:13Z). Splitting all sessions at that
timestamp, normalized per 100 assistant turns — **recomputed 2026-09-09 with the saved script
`~/.pi/agent/scripts/measure-prompt-compliance.py`** (the authoritative instrument; numbers differ
slightly from the ad-hoc run that produced the first table because the script uses a cleaner
waiting-run definition):

| metric | before (58 sess / 3008 turns) | after (16 sess / 1557 turns) | change |
|---|---|---|---|
| bash direct `grep/find/rg/fd` | 7.7 | 0.7 | **-91%** |
| `ffgrep`/`fffind` calls | 6.2 | 7.6 | +23% |
| `todo` calls | 16.8 | 19.8 | +18% |
| `notify_user` calls | 0.3 | 1.8 | +500% |
| waiting runs **without** notify | 42 of 44 (95%) | 7 of 7 (100%) | unchanged |

Retrieval and todo rules work. Only notify stayed flat: it needs the model to judge
"am I handing control back, and is the user away?" — a judgment a prompt cannot make.

## 1. Locked decisions (user, 2026-09-09)

| # | decision | value |
|---|---|---|
| D1 | `agent_settled` | **on** |
| D2 | silence window | **120 s** (on, native) |
| D3 | recap | **on**, model `deepseek/deepseek-v4-flash` |
| D4 | notify section in APPEND_SYSTEM.md | keep one line + title/priority convention |
| D5 | Phase C dedupe | delete the rpiv-todo-covered parts of todo rules #1/#2 |
| D6 | brevity vs full report | chat brevity wins for intermediate replies; full report mandatory in end-of-task summaries and any verification claim |
| D7 | channels | native only (no Telegram/Gotify/ntfy) |
| D8 | acceptance | ≥10 new sessions or 2 weeks; rollback = restore backup + delete notify config |

Facts behind D2/D3 (verified in the installed package):

- `platforms/focus.ts` implements `isWindowFocused()` for **win32 only**; on macOS it always
  returns false, so `suppressWhenFocused` is a no-op → `silenceAfterInput` is the only damper.
- `silenceAfterInput` hooks `ctx.ui.onTerminalInput` (any keypress refreshes the timestamp) and is
  applied to every trigger via `filterPlatformsAfterInput` (events.ts:187).
- `agent_settled` fires when Pi will not continue automatically (pi docs extensions.md:569), i.e.
  once per interactive turn end. With silence off that would be one banner per reply — hence D2.
- recap only applies to `agent_end`/`agent_settled`, resolves `config.recap.model` via
  `modelRegistry.find(provider, id)` and requires a non-empty **apiKey** (`events.ts:341-370`).
  Correction (verified 2026-09-09 in pi's bundled `openai-codex.js`): OAuth providers *do* yield an
  apiKey — `openaiCodexOAuth.toAuth(credential)` returns `{apiKey: credential.access}` — so an
  openai-codex recap model passes the gate. It still fails downstream: `summarize.ts` routes any
  non-anthropic api to `${baseUrl}/chat/completions`, i.e. `https://chatgpt.com/backend-api/chat/completions`,
  which returns **HTTP 403** (live test). Result is the 100-char truncation fallback, not a summary.
- `recap` posts to `${baseUrl}/chat/completions` with `Bearer <apiKey>`; on failure it returns the
  first 100 chars of the last assistant message, still more informative than "Agent is complete".
- Config is a **partial** file: `mergeWithDefaults` shallow-merges `events`, so omitting other
  keys keeps their defaults (workflow_end / ralph_loop_end / mcp_server_error stay on,
  agent_end / permission_request stay off). Path: `~/.unipi/config/notify/config.json`
  (`NOTIFY_DIRS.CONFIG`), directory does not exist yet.

## Phase 0 — baseline + backup  ✅ done 2026-09-09

1. Backups: `~/.pi/agent/backups/2026-09-09-agents-md/{AGENTS.md,APPEND_SYSTEM.md}`
   (byte-identical, sha256 recorded in the session log).
2. Scripts saved: `~/.pi/agent/scripts/measure-prompt-compliance.py` (session metrics),
   `~/.pi/agent/scripts/count-prompt-tokens.cjs` (tiktoken per file + per section).
3. Baseline recorded (o200k / cl100k):
   - `~/.pi/agent/AGENTS.md` 757 / 757
   - `~/.pi/agent/APPEND_SYSTEM.md` 860 / 1099 — sections: preamble 23, todo 346, notify 309, retrieval 182
   - project `AGENTS.md` 2804 / 2790 (out of scope)
   - behaviour baseline: bash direct search 7.7 / 100 turns, fff 6.2, todo 16.8, notify 0.3,
     waiting-without-notify 95% (before window).

## Phase A — make notify mechanical (config only)

**A1** Create `~/.unipi/config/notify/config.json`:  ✅ done — recap model corrected after a live test
(see "Execution log"): the approved `deepseek-v4-flash` returns **empty content** with the extension's
hardcoded `max_tokens: 100` because it is a reasoning model (reasoning tokens consume the budget), so
recap always degraded to the 100-char truncation fallback. `deepseek-v4-flash-vision-exp` (same price,
same provider) produced real summaries 2/2. Every other configured provider (cc-switch-deep-seek,
anyrouter, cc-switch-micu) also returned empty content — all reasoning models.

```json
{
  "events": {
    "ask_user_prompt": { "enabled": true, "platforms": [] },
    "agent_settled": { "enabled": true, "platforms": [] }
  },
  "recap": { "enabled": true, "model": "deepseek/deepseek-v4-flash-vision-exp" },
  "silenceAfterInput": { "enabled": true, "windowMs": 120000, "platforms": ["native"] }
}
```

**A2** Replace the `## Agent 停下等待用户时必须主动 notify` section (309 tok) in
`APPEND_SYSTEM.md` with this 171-token version (the extra paragraph vs the plan draft tells the model
that the notification body is a recap of its final message, replacing the old message-format rule):

```markdown
## Agent 停下等待用户时

机械触发已接管常规通知：`ask_user_prompt`（弹问卷时）和 `agent_settled`（每轮 run 结束）会自动通知，正文由 recap 摘要生成。常规场景不要手动调用 notify_user，避免重复通知。

手动调用只用于机械触发覆盖不到的场景（无 TTY / RPC 运行）或需要升优先级时：title 用短标题点明状态（如「需要你决策」「待你验收」），重要抉择 priority 用 high，其余 normal。

通知正文取自最后一条消息的摘要——停下时把「卡在哪 + 需要你做什么」直接写进消息，不要指望通知替你解释。
```

Verify (done, see Execution log): config loads through the extension's own `loadConfig()` with 12/12
checks; silence window behaves as specified at 30/119/121/600 s; recap produces a real summary with
the vision-exp model. **Delivery itself still needs a pi restart + one live settle** — the config is
read at `session_start`, so this session still runs the old defaults.

Risk / rollback: one-line flip `events.agent_settled.enabled` → `false`, or delete the config file.

## Phase B — write down brevity vs report precedence

Add one bullet to the `### Validation and reporting` section of `~/.pi/agent/AGENTS.md`
(the precedence chain already ranks project instructions above this profile, which would otherwise
make "keep answers short" absolute and kill the full report):

> Project brevity rules ("keep answers short") govern intermediate chat replies only. End-of-task
> summaries and any claim about verification still carry the full passed / failed / not run /
> unresolved report; phase-end summaries stay to 1-2 lines.

This aligns with the existing Chinese todo rule #4 (1-2 line phase summaries + full task-end summary).
Verify: token delta < 30; both files agree on the same split.
Rollback: delete the bullet.

## Phase C — dedupe against rpiv-todo's always-on guidelines

`@juicesharp/rpiv-todo` already injects 8 always-on `promptGuidelines` covering the Chinese todo
rules #1 (3+ step trigger) and #2 (immediate completion, no batching, one in_progress). Edit
`APPEND_SYSTEM.md`:

- rule #1 → keep only the unique granularity spec
  (`每个可独立验证的子步骤一条；比 task_plan.md 的 phase 细一层（每 phase 约 3-8 条）`);
- rule #2 → delete;
- renumber the remaining rules (#3–#6 → #2–#5).

Not touched: the section intro (its "1-2 步跳过" clause also duplicates the extension, but it was
outside the approved cut), rules #3–#6, the retrieval section (measured effective), the English profile.

Verify: todo section 346 → 312 tok (measured); every remaining rule has no always-on equivalent in
`DEFAULT_PROMPT_GUIDELINES` (rpiv-todo/todo.ts:56-65).

Honest note: the yield is only -34 tok, not -100, because the section intro
("所有 3+ 步…1-2 步的小任务跳过，不建清单") carries most of the duplication and was left in place
(outside the approved cut). The value here is removing conflicting duplicate rules, not token savings.

## Execution log (2026-09-09)

| step | result |
|---|---|
| Phase 0 backups | `~/.pi/agent/backups/2026-09-09-agents-md/` — byte-identical, sha256 recorded |
| scripts | `~/.pi/agent/scripts/{measure-prompt-compliance.py,count-prompt-tokens.cjs,verify-notify-config.mjs}` |
| A1 config | created; verified via the extension's own `loadConfig()` (jiti) — 12/12 checks PASS |
| A1 silence | `filterPlatformsAfterInput` at 30 s/119 s → silenced; 121 s/600 s/no-input → send |
| A1 recap | `summarizeLastMessage` live: vision-exp 2/2 real summaries (~1 s); flash/pro/relay/micu 0/2 (empty content, reasoning eats `max_tokens: 100`). openai-codex/gpt-5.6-luna: apiKey gate passes (OAuth `toAuth` returns the access token) but POST to `chatgpt.com/backend-api/chat/completions` returns 403 → truncation fallback |
| A2 | notify section 309 → 171 tok |
| B | AGENTS.md 757 → 807 tok (+50), one bullet in Validation and reporting |
| C | todo section 346 → 312 tok, rules #3–#6 renumbered to #2–#5 |
| totals | global 1617 → 1495 o200k tok (-122) |
| not verified | live notification delivery (needs pi restart; config is read at `session_start`) and behaviour metrics (needs ≥10 new sessions) |
| config update | 2026-09-09: `permission_request` → **enabled**. `@gotgenes/pi-permission-system` emits `permissions:ui_prompt` on `pi.events` immediately before a human dialog (`local-user-authorizer.ts:55-56`, bus wired at `index.ts:148`), and notify has a purpose-built body builder → `Agent requested bash '<cmd>'.` (+`(forwarded)` for subagent asks). Measured review-log frequency: 174 `permission_request.waiting` since 08-30, 166 of them in one policy-setup session, 8 in the 09-08 self-test → near-zero routine noise, and it is the strongest "agent is blocked on you" signal. `verify-notify-config.mjs` 12/12 PASS. |
| config update | 2026-09-09: `silenceAfterInput.enabled` → **false**. The window is keypress-based, not focus-based: submitting a prompt is itself a keypress, so any run settling <120 s after your last keystroke (including the `ask_user_prompt` "blocked on you" banner) was silently dropped, not delayed. macOS has no focus detection (`focus.ts` darwin branch is a TODO stub → `suppressWhenFocused` is a no-op), so disabling silence is the only way to guarantee delivery. `verify-notify-config.mjs` updated + 12/12 PASS. |

## Recap model decision (2026-09-09, user asked for official luna)

User wanted `recap.model` on the official OpenAI luna. Measured outcome — **not possible without patching**:

- `openai-codex/gpt-5.6-luna`: the notify recap only POSTs `${baseUrl}/chat/completions` with a bearer
  token; `chatgpt.com/backend-api/chat/completions`, `/codex/chat/completions` and `/v1/chat/completions`
  all return 403 (Cloudflare). The official surface is `/codex/responses` (400 "Store must be set to false"
  without `store:false`), needs `chatgpt-account-id` (decoded from the OAuth JWT), `originator`,
  `OpenAI-Beta: responses=experimental`, and rejects `max_output_tokens`.
- Verified working on that endpoint: `reasoning:{effort:"none"}` → 1.9 s, 34 output tokens, 0 reasoning
  tokens, clean one-line summary (luna supports none/low/medium…, not `minimal`).
- `cc-switch-micu/gpt-5.6-luna`: gateway needs `/v1` in baseUrl (root returns its HTML dashboard), and
  even then returns gzip bytes **without** a `Content-Encoding` header plus 25 s+ spikes → the recap's
  `response.json()` throws → truncation. Not viable.
- **Decision: keep `deepseek/deepseek-v4-flash-vision-exp`** (2/3 real summaries measured, ~1 s, else a
  100-char truncation). Official luna is used for the OM memory model only, where pi's own API layer
  supplies the codex headers — verified with an OM-shaped `agentLoop` call: `record_observations` tool
  called, `reasoning: "low"` accepted, ~12 s, no errors.
- Separate finding (user's config, not fixed here): `cc-switch-micu` baseUrl is missing `/v1`, which
  breaks pi's own main path (`pi --model cc-switch-micu/gpt-6-astra -p` → "Stream ended without
  finish_reason"); `/v1` returns proper SSE.
Rollback: restore from Phase 0 backup.

## Phase D — acceptance (≥10 new sessions or 2 weeks)

Run `~/.pi/agent/scripts/measure-prompt-compliance.py`:

| criterion | target | baseline (script, 2026-09-09) |
|---|---|---|
| waiting-without-notify | < 20% | 95% before / 100% after window |
| bash direct search | < 2 / 100 turns | 0.7 (after window) |
| todo usage | ≥ 10 / 100 turns | 19.8 (after window) |
| prompt tokens | ≤ baseline | 757 + 860 = 1617 o200k |

Rollback action for any breach: restore Phase 0 backups + delete notify config.

## Expected effect

- system prompt: -138 tok (notify) -34 tok (todo) +50 tok (AGENTS.md bullet) ≈ **-122 tok**,
  i.e. APPEND_SYSTEM.md 860 → 688 tok, global total 1617 → 1495 o200k. Cost effect negligible; the
  point is removing always-on duplication and the notify judgment rule.
- notify reliability: from ~5% of waiting runs notified to mechanical coverage of questionnaire
  prompts and run settles.
- new recurring cost: one deepseek-v4-flash-vision-exp call per run settle (~130 in / ≤100 out tok,
  ~$0.00005), only when the 120 s silence window has elapsed.
