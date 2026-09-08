---
name: plan-loop
description: Orchestrates the plan-phase closed loop across /brainstorm mode (diverge) -> grilling (converge) -> planning-with-files (persist), with phase gates, artifact handoffs, and a re-entry protocol that re-opens grilling when execution diverges from the plan. Use when the user asks to plan, brainstorm-then-build, think something through before implementing, or when an in-flight plan has drifted and needs re-planning. Assumes `/brainstorm` mode — this skill is used together with it; availability is not hedged.
---

# Plan-Loop — Plan-Phase Closed Loop

Thin orchestrator. Do NOT re-implement anything: each stage delegates to a specialized skill/mode. The value is the **gates between stages**, the **artifact contracts**, and the **loop-back protocol**. The loop is closed when execution feeds divergence back into planning instead of silently abandoning the plan.

**Assumption:** this skill is used together with `/brainstorm` mode — the mode's availability is taken for granted, not hedged (no fallback, no harness adaptations).

## Stage Map

| # | Stage | Owner | Entry condition | Exit gate | Artifact handed to next stage |
|---|-------|-------|-----------------|-----------|-------------------------------|
| 0 | Entry check | plan-loop | task accepted | decision: plan / trivial / re-entry | — |
| 1 | Diverge | `/brainstorm` mode | idea exists, no approved direction | brief written **and** direction approved by user | decision brief |
| 2 | Converge | grilling skill | brief exists | frontier empty **and** user confirms shared understanding **and** settled decisions written to disk | settled decisions (on disk) |
| 3 | Persist | planning-with-files | decisions settled and on disk | **user approves the written plan → then** plan attested **and** Next Step names one action | task_plan.md / findings.md / progress.md |
| 4 | Execute + loop | planning-with-files + plan-loop | plan attested **after user approval** | divergence signal -> re-enter Stage 2; else `check-complete` **and user confirms delivery** | updated + re-attested plan |

Do not advance a stage until its exit gate passes. Do not skip gates because the task "feels simple" — a one-line plan is still a plan.

## Stage 0 — Entry Check

1. Trivial task (single-file edit, quick lookup, <3 tool calls)? Skip planning, say why in one line.
2. `task_plan.md` or `.planning/` already exists? Go to **Stage 4** (re-entry protocol), never restart from scratch.
3. A decision brief already exists (e.g. the user started in `/brainstorm` mode and exported it)? Verify it meets the Stage 1 exit gate, then enter **Stage 2** directly. "Exists" means on disk: locate and read it per the Stage 1 brief location protocol; a brief that lives only in conversation context does not qualify.
4. Otherwise enter Stage 1.

**Preferred path (recommendation, never a gate):** when the user is starting fresh, suggest they brainstorm first and come back with the exported brief — rule 3 then skips straight to Stage 2. This matches the natural explore-then-commit order and keeps the loop from orchestrating a mode switch mid-flow (the loop's own context does not run inside the mode). Remind them a raw transcript is not a brief: export **"Brief to markdown"**.

## Stage 1 — Diverge (`/brainstorm` mode)

- **Already brainstormed?** If the user arrived here with an exported brief (markdown on disk and/or in context) and a confirmed direction, skip this stage and go to Stage 2. Ask only the one gate question: "方向 OK 吗" — approval is part of the gate.
- Ask the user to start `/brainstorm` mode (`/brainstorm` or `Ctrl+Alt+B`). It is read-only: exploration without committing.
- **Mode exit is a user action:** the user ends `/brainstorm` manually (e.g. `/brainstorm finish` or the mode's exit affordance) — the agent must not run Stage 2 while the mode is still active (grilling's frontier rounds must not run inside a one-question-at-a-time mode), and should ask the user to end it if needed. When the user finishes, prefer the **"Brief to markdown"** (or "...and context") export so the brief lands on disk.
- **Brief location protocol — read the export from disk, never from memory:** the export lands in a `brainstorms/` subdirectory of the working directory as `<cwd>/brainstorms/YYYY-MM-DD-brainstorm.md` (observed in this harness), **not** in `.planning/`. Before entering Stage 2 the agent MUST locate and read the exported brief from disk: scan `brainstorms/`, `.planning/`, the project root, and recently-modified `*.md` files (e.g. `find <project> -name "*.md" -newermt "-2 hours"`), then read the file to confirm it is the brief. A single empty-directory check (e.g. `.planning/` has nothing) is **not** evidence that no export exists — search more broadly before concluding. If no brief can be found on disk, the Stage 1 gate has NOT passed: tell the user the expected location(s) and ask them to export/re-export or provide the path; never proceed to Stage 2 on transcript memory alone.
- **Exit gate:** a *decision brief* exists — goal, constraints, 2-3 options with trade-offs, a recommendation, open questions — **and** the user has approved the direction **and** the mode is exited. A raw transcript is not a brief; do not proceed to Stage 2 on one.

## Stage 2 — Converge (grill)

- Call the Skill tool with `grilling`, feeding it the brief. If ADRs/glossary are wanted, call `grill-with-docs` instead.
- **Structured question tools:** when the harness offers one with a per-call question cap (e.g. 4), grilling rounds still cover the whole frontier: split across as many calls as needed, ordered by dependency (never by convenience), and never fire multiple calls back-to-back — ask one slice, wait for answers, then the next.
- **Exit gate:** frontier empty **and** user confirms shared understanding. Output is *settled decisions*: every branch of the design tree visited, rejected options recorded. Facts are found, never asked — dispatch lookups instead of interrogating the user for things you can check.
- **Artifact contract:** before the exit gate passes, write the settled decisions to disk (findings.md or a dedicated decisions section). Stage 3 reads the on-disk record, not the transcript — compaction between stages must not be able to lose decisions.

## Stage 3 — Persist (planning-with-files)

- Run planning-with-files: `init-session` first, then write `task_plan.md` phases derived **one-to-one from settled decisions** (a decision with no phase is an unrecorded decision), research into `findings.md`, log start into `progress.md`.
- **Approval gate (before attestation):** present the written plan to the user — a one-page summary of phases plus the decisions table is enough — and get an explicit "go". Sequence is: write plan → **user approves** → `attest-plan` → Stage 4. Attestation locks what the user actually saw; attesting first inverts that guarantee. Approving the design decisions during grilling is not approval of the written plan.
- **Attestation semantics:** the attestation covers decisions/scope. Execution-phase status flips (`pending → in_progress → complete`) are forward-motion bookkeeping, not tampering — re-attest only when decision/scope content changes, and always before closing the loop.
- **Exit gate:** plan attested **after user approval** **and** `## Next Step` names a single next action.

## Stage 4 — Execution & Loop-Back Protocol

During execution, re-enter **Stage 2** on ANY of these divergence signals — do not silently continue on a stale plan:

- tests failing repeatedly (the 3-strike protocol was hit — 3 failed attempts at the *same* problem; distinct one-off errors fixed on attempt 1 are normal progress, not divergence)
- new or changed requirements from the user
- a phase blocked
- plan no longer matches reality (user says so, or `git diff` shows drift)

Re-entry procedure: grill the divergence (what changed, what it invalidates) -> update `task_plan.md` -> **re-attest**. If no divergence ever fires, the exit protocol is `check-complete` **and** user confirms delivery — do not self-close the loop; a delivery confirmation is a gate, not a courtesy.

## Rules

- Never merge question styles: brainstorm = one-at-a-time; grilling = frontier rounds. Keep stages sequential, hand off artifacts only.
- A plan that survives execution unchanged is the goal. A plan silently abandoned is the failure mode this skill exists to prevent.
- When re-planning, the divergence is the new brief: skip Stage 1, start at Stage 2.
- Nothing is attested before the user has seen it; execution never starts before attestation of an approved plan.
- Stage handoffs must be verifiable from disk (brief → decisions → plan), never from transcript memory alone.
