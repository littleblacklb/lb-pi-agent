---
name: git-auto-commit
description: Automatically create safe local Git checkpoint commits after Codex modifies files in an existing repository and reaches a validated, self-contained working unit, even when the user did not explicitly ask for a commit. Use for implementation, bug fixes, refactors, tests, docs, configuration changes, and "continue nonstop" work. Also use when the user explicitly asks Codex to commit. Preserve unrelated work, obey repository rules and explicit no-commit instructions, and never push or rewrite history without confirmation.
---

# Git Auto Commit

Create durable local commits without waiting for a separate commit request. Treat validation, task-owned staging, and local-only scope as hard gates.

## Apply authority first

Apply instructions in this order:

1. Follow the user's current instructions.
2. Follow repository rules such as `AGENTS.md`, contribution guides, and commit conventions.
3. Follow this skill.

Do not commit when the user says not to commit or repository rules forbid automatic commits.

## Establish the repository boundary

Before editing, when practical:

1. Run `git rev-parse --show-toplevel` to identify the actual repository.
2. Run `git status --short` and remember pre-existing modified, staged, and untracked files.
3. Identify the files owned by the current task.

If the current directory is not inside a Git repository, skip commit work silently. Never run `git init` just to satisfy this skill.

In nested-repository workspaces, run Git commands in the repository that owns the modified files.

## Recognize a checkpoint

Commit automatically when all of these conditions hold:

- The task produced repository changes.
- The changes form a self-contained, working unit, such as a completed fix, feature slice, refactor phase, test update, or documentation update.
- Relevant validation passes.
- The task-owned changes can be staged without including unrelated work.

Group related changes into one meaningful commit. Do not create a commit for every trivial edit. For a small task, one final checkpoint commit is normally enough. For a long multi-phase task, commit each validated phase as it becomes independently coherent.

Do not treat failing, unverified, partial, or knowingly broken work as a checkpoint.

## Pass the validation gate

Before every commit:

1. Run validation proportional to the change and repository guidance.
2. Inspect `git status --short`.
3. Review the task diff for correctness and accidental changes.
4. Report validation truthfully. Never invent commands, output, or success.

If required validation cannot run or fails, do not auto-commit. Explain the limitation and continue fixing when it is in scope.

## Stage only task-owned changes

Use explicit paths:

```bash
git add -- path/to/file1 path/to/file2
```

Never use `git add -A`, `git add .`, broad globs, or another sweep that can capture unrelated changes.

After staging:

1. Inspect `git diff --cached --stat`.
2. Inspect `git diff --cached`.
3. Confirm every staged hunk belongs to the task and no expected task file is missing.

Preserve pre-existing user changes and unrelated untracked files. If task changes and unrelated changes share a file, stage only the task hunks when that can be done safely. Otherwise, do not auto-commit that file or commit; report the ambiguity instead of taking ownership of unrelated work.

## Create the local commit

Use Conventional Commits:

```text
<type>(<scope>): <imperative subject>
```

- Choose from `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `build`, `ci`, or `style`.
- Keep the subject imperative and approximately 70 characters or fewer.
- Add a short body when the reason is not obvious.
- Do not add attribution or generated-by trailers.

Create the commit locally. Do not push, open a pull request, merge, rebase, reset, amend, or otherwise rewrite Git history without explicit authorization.

Do not bypass hooks or signing requirements with `--no-verify` or equivalent flags. If a hook, signing configuration, or commit command fails, preserve the index and report the failure.

## Verify and report

After a successful commit:

1. Run `git status --short`.
2. Run `git log -1 --oneline`.
3. Report the commit hash and subject, the validation performed, and any remaining unrelated working-tree changes.

If no commit was created, state the concrete reason whenever it matters to task completion.
