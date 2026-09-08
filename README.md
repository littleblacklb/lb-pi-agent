# pi agent home (version controlled)

Version control for this pi agent configuration. Tracked: agent instructions,
settings, extensions, skills, scripts, patches, plans.

## Tracked

- `AGENTS.md`, `APPEND_SYSTEM.md` — agent instructions
- `settings.json`, `trust.json`, `pi-switch.json`, `open-tui.json` — config
- `extensions/*` — extension source (no `node_modules`)
- `skills/*` — skill source (no `node_modules`)
- `scripts/`, `patches/`, `plans/`

## Ignored

- Secrets: `auth.json`, `models.json`, `models-store.json`, `web-push.json`, `mcp-oauth/`
- Runtime state and caches: `sessions/`, `state/`, `fff/`, `npm/`, `bin/`, `backups/`,
  `*-cache.json`, `extensions/*/logs/`, `extensions/*/global-approvals.json`
- Dependencies and backups: `node_modules/`, `*.bak-*`, `*.backup-*`
- `extensions/pi-guided-plan/` — separate clone with its own `.git`

## Usage

```bash
git -C ~/.pi/agent status
git -C ~/.pi/agent add <explicit paths>   # never `git add .`: node_modules and secrets live here
git -C ~/.pi/agent commit -m "..."
```

Before committing, check that nothing sensitive is staged:

```bash
git -C ~/.pi/agent diff --cached --name-only
```
