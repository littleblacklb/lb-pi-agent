# model-skill-gate

A [pi](https://pi.dev) extension that **gates skill visibility by model**:
only models you configure (e.g. the deepseek family) can see the gated skills
(obra's superpowers) in their skill catalog; every other model (gpt-5.6 etc.)
never sees them.

Nothing is auto-loaded or force-injected. Gated skills are advertised to the
gated model through pi's **native skill mechanism** — `<available_skills>`
entries with name/description/SKILL.md location — and the model reads a
SKILL.md on demand when a task matches, exactly like pi's own skills.

When a session switches models, the extension notifies you about what just
became visible/hidden, and the footer shows `⚡ superpowers` while a gated
model is active.

## How it works

- Superpowers (obra) lives in a **private clone outside pi's skill scan
  locations** (`~/.pi/gated-skills/superpowers`), so it is invisible to every
  model by default.
- On every user turn (`before_agent_start`), if the current model matches a
  rule the extension merges the gated skills' catalog entries into the system
  prompt's own `<available_skills>` block (native XML: `name`, `description`,
  `location` → absolute SKILL.md path). The model can then `read` any of them.
- Non-gated models get the pristine base prompt: pi resets the system-prompt
  override whenever the handler returns nothing, so switching away
  immediately makes the gated skills disappear again — no lingering entries
  in later calls.
- Skills whose location is already present in the prompt (e.g. you installed
  them natively later) are never duplicated.

> Why not `pi install git:github.com/obra/superpowers`? The official package
> registers its own extension that injects the superpowers bootstrap into
> **every** session regardless of model — exactly what model-skill-gate
> prevents. The private clone plus this gate gives you model-scoped skills
> instead.
>
> Why not put superpowers into `~/.pi/agent/skills` and filter? The skill
> catalog is baked into the session's base system prompt once; pi's
> `resources_discover` hook has no per-model concept, so native registration
> cannot be model-scoped. Merging per user turn is the only clean seam.

## Installation

```bash
# 1. Clone superpowers outside pi's skill scan locations
mkdir -p ~/.pi/gated-skills
git clone --depth 1 https://github.com/obra/superpowers ~/.pi/gated-skills/superpowers

# 2. Install the extension
mkdir -p ~/.pi/agent/extensions/model-skill-gate
# copy this package's files (src/, package.json, tsconfig.json, README.md) there
cd ~/.pi/agent/extensions/model-skill-gate && npm install

# 3. Config is created automatically on first run at ~/.pi/model-skill-gate.json
```

Restart pi. When you use a gated model (default rule: anything matching
`*deepseek*`) the footer shows `⚡ superpowers` and the model can load those
skills on demand. Ask it e.g. "start with the brainstorming skill" — it will
`read` the listed SKILL.md.

## Configuration

`~/.pi/model-skill-gate.json` (created with defaults on first run):

```jsonc
{
  "rules": [
    {
      "match": ["*deepseek*"],   // patterns: wildcard/exact
      "skills": [                // catalog roots advertised to matching models
        {
          "name": "superpowers",
          "path": "~/.pi/gated-skills/superpowers/skills/using-superpowers"
        }
      ]
    }
  ],
  "indexDirs": ["~/.pi/gated-skills/superpowers/skills"],
  "warn": { "onLeave": true, "onEnter": true },
  "statusBar": true
}
```

| Key | Meaning |
|-----|---------|
| `rules[].match` | Glob/exact patterns, case-insensitive. `*deepseek*`, `deepseek/*`, `gpt-5.6*`, `deepseek/deepseek-v4-pro`. A model matches if any pattern matches its bare id **or** `provider/id`. |
| `rules[].skills[]` | Catalog roots. A root contributes itself when it contains `SKILL.md`, plus every direct child dir containing `SKILL.md` (a `skills/` collection). |
| `indexDirs[]` | Extra catalog roots combined with the per-rule `skills` roots (deduplicated by SKILL.md location). |
| `warn.onLeave` | Notify when a session **started gated** switches to a non-gated model: skills are now hidden for the current model. |
| `warn.onEnter` | Notify when a session that did **not** start gated switches to a gated model: skills are available from the next turn. |
| `statusBar` | Show `⚡ <skills>` in the footer while a gated model is active. |

Warnings fire once per session and direction. Session restore (`/resume`,
startup) never warns. Config edits are picked up automatically (mtime checked
per call); `/skill-gate reload` resets runtime caches. The interactive picker
writes the same JSON atomically, so it remains easy to audit or edit by hand.

## Commands

- `/skill-gate` — show config path, current model, starter model (gated?),
  gate state with visible skill count, warning toggles, and each rule.
- `/skill-gate models` — open the Superpowers access picker. Use arrow keys to
  move, `Space` to toggle the focused model, `Enter` to save, and `Esc` to
  discard. The picker lists models available to the current pi session,
  respecting `--models` / `enabledModels` scoping.
- `/skill-gate reload` — reset runtime caches.

## Debugging / E2E

```bash
# Verbose console logging per user turn
PI_MODEL_SKILL_GATE_DEBUG=1 pi

# Deterministic event log to a file
# (bas lines only appear for gated models: entries=N inserted=M)
PI_MODEL_SKILL_GATE_LOG=/tmp/gate.log pi

# Override the config path (tests)
PI_MODEL_SKILL_GATE_CONFIG=/tmp/cfg.json pi
```

## Tests

```bash
npm run check   # tsc --noEmit + vitest (50 unit/integration tests)
```

`src/integration.test.ts` exercises the real `~/.pi/gated-skills/superpowers`
clone when present (skipped otherwise). E2E verified end-to-end against real
models (deepseek ↔ gpt-5.6):

- deepseek turns: `bas … gated=true entries=14 inserted=14` and the model
  actually enumerates all 14 superpowers skills from `<available_skills>`;
- gpt-5.6 (openai-codex & anyrouter) turns: no `bas` line ever, model answers
  "NONE" when asked for gated skills;
- switching inside a session flips visibility immediately in both directions
  (leave/enter notices with the new copy, `⚡` status follows, next prompt
  uses the gated or pristine prompt accordingly).

## Limitations

- The skill catalog is merged on **user turns** (`before_agent_start`). A
  model switch takes effect from the next prompt on.
- A model that already saw the gated skills earlier in a session may remember
  them from the conversation history — visibility gating controls what the
  prompt advertises, not the model's memory of past turns. `/new` gives a
  fully clean session.
- Gated skills are not registered as pi resources, so they don't appear in
  `/skill:name` completions or the startup header — they are advertised
  through the prompt only, which is what keeps them invisible to non-gated
  models.
- Merging relies on the base prompt containing an `<available_skills>` block
  (always true for default prompts; custom prompts without one get a
  standalone section appended).

## Uninstall

```bash
rm -rf ~/.pi/agent/extensions/model-skill-gate
rm -f ~/.pi/model-skill-gate.json
# optional: rm -rf ~/.pi/gated-skills
```

## License

MIT
