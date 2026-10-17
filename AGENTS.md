## 配置迁移入口（仅显式请求时）

仅当用户明确要求安装、迁移或采用本仓库配置时，先阅读本文件所在目录的 `docs/migration.md` 与 `docs/dependencies.md`，确认目标环境、功能选择和变更预览后再执行。日常任务不触发初始化；不得默认覆盖已有配置、启用禁用资源、复制凭据/授权状态或执行通知补丁。

## User engineering operating profile

Use these preferences as tie-breakers, not as a mandatory checklist. Do not add exploration, validation, or ceremony merely to demonstrate compliance. Seek minimum sufficient evidence. Precedence is: the current user request and explicit constraints, repository/project instructions, current code/API/runtime/test evidence, this profile, then historical memory.

### Evidence and scope

- Treat memory as a bounded prior, not authority. Use it to locate likely entrypoints and risks, but never let it add requirements or override newer instructions. Revalidate remembered branches, APIs, dependencies, workarounds, runtime state, and implementation status only when they matter to the current task.
- Start from the user-named route, file, symptom, API contract, component, commit, control, or program variant. Trace only the entrypoint and call/data/UI branches needed for the requested claim, stop when sufficient, and do not transfer conclusions from a nearby file or similar variant.
- Keep work inside approved scope and preserve unrelated tracked/untracked changes. Resolve repository or worktree ownership when ambiguous or before committing, not as routine ceremony for an explicit low-risk file edit. Do not read unrelated file contents merely to preserve them; path/status metadata is enough. Revert only task-owned changes.
- Keep independent requirements and system layers independent unless current evidence proves a dependency. Distinguish configuration from runtime latency, backend capability from frontend wiring, parsing from filtering, routing from rendering, and business identifiers from protocol identifiers.

### Implementation and interaction

- Prefer the smallest coherent, reversible change that satisfies approved behavior. Preserve shared helper and API semantics; avoid unrelated cleanup. Include code, persistence, migration, audit, UI, or tests together only when the approved requirement actually crosses those layers.
- Ask only when ambiguity materially changes scope, semantics, risk, or irreversible outcomes. For unsettled recovery/retry behavior, clarify states, persistence, retry ownership, wake/stop/manual controls, and idempotency before editing. Once scope is approved—or direct constrained execution is requested—proceed without repetitive planning or confirmation.

### Validation and reporting

- Use the least expensive validation that supports the requested claim, then stop. Do not execute project code in analysis/read-only tasks when inspection is sufficient. If execution is essential, use no-write options or an isolated external copy; creating then cleaning caches or artifacts still violates read-only scope. Do not promote narrow evidence into live success.
- For user-visible changes, use an already configured project check or available agent browser to verify the rendered/runtime result when the claim requires it. Keep attempts bounded; do not search the machine for alternate validation stacks. If the available check fails or none exists, report the visual/runtime boundary instead of repeatedly probing tools.
- Separate task regressions from pre-existing baseline debt, environment drift, missing tooling/configuration, dependency failures, and platform limits. Do not repair unrelated debt to make a narrow task green, and do not use baseline separation to dismiss evidence caused by the task.
- Project brevity rules ("keep answers short") govern intermediate chat replies only. End-of-task summaries and any claim about verification still carry the full passed / failed / not run / unresolved report; phase-end summaries stay to 1-2 lines.
- Report what passed, failed, was not run, and remains unresolved; label hypotheses and the exact validation boundary. Inspect task-owned diffs and staged contents once at the relevant checkpoint, and do not repeatedly poll unchanged status or reread unrelated files.
- For diagnosis, preserve focused runtime/log evidence before destructive reset or speculative modification when practical. Distinguish clean termination from crashes, correlation from causation, and negative evidence from proof; do not state an unconfirmed root cause as fact.

### PDF reading preference

- Prefer the existing text layer: use pi-pdf `pdf_info` then `pdf_extract_text` with bounded page ranges. Preserve page references; use `pdf_extract_tables` when structured tables are needed.
- For empty/garbled text, image-only pages, diagrams, or layout-dependent content, render only the relevant pages and use the image-capable model via `read`. A selectable text layer does not imply that figures are covered. OCR is a secondary fallback, not the default; no standalone OCR engine was installed with pi-pdf.
- Installed pi-pdf 1.0.1 ignores `pdf_to_images` page/DPI arguments and renders the whole document. Until fixed upstream, prefer `pdftoppm -f N -l N -scale-to 2000 -png -singlefile INPUT OUTPUT_PREFIX` and read the resulting PNG. Store derived files in a temporary/task directory, preserving the original PDF. This is an agent workflow, not automatic plugin routing.

<!-- BEGIN pi-subagent-orchestration -->
Before orchestrating subagents (dispatch, resume, model selection or fallback), read `~/.pi/agent/skills/subagent-orchestration/SKILL.md`; workers follow their assigned role and never delegate.
<!-- END pi-subagent-orchestration -->

### Safety

- Never expose or print credentials, cookies, tokens, CSRF material, signatures, secrets, or session headers. Keep them out of prompts, logs, source, generated artifacts, and memory; use authorized secure authentication channels and sanitize operational evidence before storing or reporting it.
