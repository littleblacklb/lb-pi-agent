---
name: subagent-orchestration
description: "Required before orchestrating subagents: dispatch, resume, delegation/model selection, handoff, fallback, stop, or review delegation. Main-agent workflow only; workers follow their assigned role without loading this skill merely to execute a task."
---

# Subagent orchestration

## Authorization and responsibility
- Main agent owns requirements, decisions, integration and final acceptance. Approved plan → user authorizes execute → bounded dispatch. Without a plan, direct execution stays in main unless user explicitly allows delegation. Small or ambiguous work stays in main; do not impose planning ceremony.
- Split by responsibility, not files. Keep strongly coupled modules together. Never delegate unresolved business decisions or fill spare concurrency slots for their own sake.
- Reviewer requires explicit user approval. Complexity, failures and risk do not authorize one. Worker self-tests and main-agent diff checks are still required.
- Workers never delegate, including via shell/RPC. No scheduled jobs or scripted workflows. Do not introduce durable queues or retry state machines without a new approved design.

## Model selection
- Default implementation: `openai-codex/gpt-6.1-sol`.
- User-chosen cost-saving execution, announced SOL-unavailable/quota fallback, and user-approved review: `xiaolubao/deepseek-v4.1-flash`.
- Priority: current user choice > current budget policy > default. Do not infer quota or switch to Flash just because a task is simple.
- Astra is only for explicitly authorized planning. Never automatically use it for execution, diagnosis, review or fallback; never automatically create an Astra planner.
- Every NEW Agent call specifies an exact available `provider/modelId`. Never omit model and inherit the parent model. Inspect current role config first: manual frontmatter model pins override call parameters. Respect user edits; explain conflicts and ask instead of rewriting them.
- Verify exact availability before dispatch and actual returned model afterward. The plugin's fuzzy/cross-provider fallback is not permission to change channels. If availability is uncertain, stop. Missing actual-model metadata is an unresolved verification boundary, not proof of the requested route.
- Resume retains the existing session model; passing model is not a switch. To change models, confirm old task termination, inspect changes and start a new worker with a bounded handoff. No automatic Flash→SOL/Astra upgrade or blind retry loop.

## Concurrency and context
- At most TWO live workers total: foreground, background, resumed and manually started. Conservatively count queued work too. Pools do not enforce the combined cap or coordinate separate Pi hosts.
- Prefer background starts/resumes; foreground only when the next step depends on it and no useful independent work remains. Never overlap writers without explicit ownership.
- New responsibility: fresh conversation (`inherit_context:false`). Keep applicable project rules, skills and permission extensions; do not use isolated mode or disable extensions to bypass restrictions. Append-mode roles inherit system rules, not full chat.
- Same-responsibility rework: resume the settled original agent. Changed responsibility/core assumptions or repeated failure: fresh context with bounded evidence. Stop affected work and escalate unapproved shared-interface/business changes.

## Handoff
Every dispatch carries:
1. task_id, responsibility, approved goal and non-goals.
2. PRD/plan paths and version or approved decision summary.
3. Relevant rules, source paths, dependencies and interfaces.
4. Allowed changes, workspace ownership and no-overlap boundary.
5. Acceptance checks and expected evidence/report.
6. Exact model and reason, context policy.
7. Absolute PWF plan path and PLAN_ID/PWF_PLAN_ROOT when applicable.

Only the orchestrator writes shared task_plan.md, findings.md, progress.md, selectors and attestations. Workers do not initialize/rotate plans; return reports or use only separately assigned ledgers. Tool subprocess exports do not bind the host; concurrent hosts must be pinned before launch. Do not copy this full skill into worker prompts: send only the bounded handoff and necessary decisions.

## Completion, stop and fallback
- Background completion is notified; do not poll or sleep. Retrieve full results with get_subagent_result. Use steer_subagent for a running task; resume only after settling.
- Cancelling a result wait does not stop the worker. Stop via `/agents` → Running agents → selected task → `x` twice.
- Plugin stopped status precedes complete teardown. Confirm tool activity has ceased and inspect changes before reassignment. Uncertain termination means pause, not duplicate writers.
- Distinguish model/channel failure from implementation failure. Before SOL→Flash, announce the fallback, confirm termination, inspect partial writes and transfer ownership explicitly.
- Reports: changed files; passed/failed/not-run checks with evidence; unresolved issues, assumptions and handoff notes. Parent verifies actual diffs, model metadata and actual resumable handle, never invented results. Keep credentials and sensitive session material out of handoffs/reports.

## Configuration boundaries
- Global settings: `~/.pi/agent/subagents.json`; project overrides: `<cwd>/.pi/subagents.json`.
- Roles: project `.pi/agents/` overrides global `~/.pi/agent/agents/`. Role files intentionally omit model. Preserve manual configuration; never regenerate it each task.
- These instructions are behavior controls, not a model whitelist or filesystem sandbox. Tool visibility and skills metadata do not prove permission enforcement. Document native hard limits separately from soft scheduling rules.
