---
name: "playwright"
description: "Use when the task requires automating a real browser from the terminal (navigation, form filling, snapshots, screenshots, data extraction, UI-flow debugging) via `playwright-cli` or the bundled wrapper script. For bot-blocked sites (403, Cloudflare, captcha), escalate to the bundled Camoufox driver."
---


# Playwright CLI Skill

Drive a real browser from the terminal using `playwright-cli`. Prefer the bundled wrapper script so the CLI works even when it is not globally installed.
Treat this skill as CLI-first automation. Do not pivot to `@playwright/test` unless the user explicitly asks for test files.

## Prerequisite check (required)

Before proposing commands, check whether `npx` is available (the wrapper depends on it):

```bash
command -v npx >/dev/null 2>&1
```

If it is not available, pause and ask the user to install Node.js/npm (which provides `npx`). Provide these steps verbatim:

```bash
# Verify Node/npm are installed
node --version
npm --version

# If missing, install Node.js/npm, then:
npm install -g @playwright/cli@latest
playwright-cli --help
```

Once `npx` is present, proceed with the wrapper script. A global install of `playwright-cli` is optional.

## Skill path (set once)

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
```

User-scoped skills install under `$CODEX_HOME/skills` (default: `~/.codex/skills`).

## Quick start

Use the wrapper script:

```bash
"$PWCLI" open https://playwright.dev --headed
"$PWCLI" snapshot
"$PWCLI" click e15
"$PWCLI" type "Playwright"
"$PWCLI" press Enter
"$PWCLI" screenshot
```

If the user prefers a global install, this is also valid:

```bash
npm install -g @playwright/cli@latest
playwright-cli --help
```

## Core workflow

1. Open the page.
2. Snapshot to get stable element refs.
3. Interact using refs from the latest snapshot.
4. Re-snapshot after navigation or significant DOM changes.
5. Capture artifacts (screenshot, pdf, traces) when useful.

Minimal loop:

```bash
"$PWCLI" open https://example.com
"$PWCLI" snapshot
"$PWCLI" click e3
"$PWCLI" snapshot
```

## When to snapshot again

Snapshot again after:

- navigation
- clicking elements that change the UI substantially
- opening/closing modals or menus
- tab switches

Refs can go stale. When a command fails due to a missing ref, snapshot again.

## Recommended patterns

### Form fill and submit

```bash
"$PWCLI" open https://example.com/form
"$PWCLI" snapshot
"$PWCLI" fill e1 "user@example.com"
"$PWCLI" fill e2 "password123"
"$PWCLI" click e3
"$PWCLI" snapshot
```

### Debug a UI flow with traces

```bash
"$PWCLI" open https://example.com --headed
"$PWCLI" tracing-start
# ...interactions...
"$PWCLI" tracing-stop
```

### Multi-tab work

```bash
"$PWCLI" tab-new https://example.com
"$PWCLI" tab-list
"$PWCLI" tab-select 0
"$PWCLI" snapshot
```

## Escalation: bot-blocked sites (opt-in)

When the default flow is blocked — HTTP 403, Cloudflare "Just a moment...", captchas, or other anti-bot walls — escalate to the Camoufox anti-detect browser instead of fighting the block. Camoufox injects realistic device fingerprints at the C++ level, so automation is much harder to detect than plain playwright-cli Chromium.

- **Decision rule**: if playwright-cli hits a 403/challenge/captcha, switch to the Camoufox driver.
- **Cost**: ~200MB browser download on first use; only pay it when a site actually blocks you.
- **Driver**: `scripts/camoufox_run.mjs` (separate JS driver; self-installs deps and browser on first run).

```bash
export CAMOUFOX_DRIVER="$HOME/.pi/agent/skills/playwright/scripts/camoufox_run.mjs"
# If this skill is installed under Codex, use "$CODEX_HOME/skills/playwright/scripts/camoufox_run.mjs" instead.

"$CAMOUFOX_DRIVER" https://blocked-site.example --geoip
"$CAMOUFOX_DRIVER" https://blocked-site.example --os windows --proxy http://user:pass@host:port --screenshot output/playwright/cf.png
"$CAMOUFOX_DRIVER" https://blocked-site.example --js "navigator.userAgent"
```

This is NOT a playwright-cli flag: playwright-cli attaches via CDP (Chromium), while Camoufox is Firefox speaking the Juggler protocol and needs its own driver. Do not try to route Camoufox through playwright-cli.

Verified behavior (camoufox-js 0.12.0): fingerprints rotate per launch, `navigator.webdriver` is false. Cloudflare challenges did NOT reliably clear headless in testing — do not promise Cloudflare bypass. See `references/camoufox.md` for details, options, and risks.

## Wrapper script

The wrapper script uses `npx --package @playwright/cli playwright-cli` so the CLI can run without a global install:

```bash
"$PWCLI" --help
```

Prefer the wrapper unless the repository already standardizes on a global install.

## References

Open only what you need:

- CLI command reference: `references/cli.md`
- Practical workflows and troubleshooting: `references/workflows.md`
- Camoufox escalation (bot-blocked sites): `references/camoufox.md`

## Guardrails

- Always snapshot before referencing element ids like `e12`.
- Re-snapshot when refs seem stale.
- Prefer explicit commands over `eval` and `run-code` unless needed.
- When you do not have a fresh snapshot, use placeholder refs like `eX` and say why; do not bypass refs with `run-code`.
- Use `--headed` when a visual check will help.
- When capturing artifacts in this repo, use `output/playwright/` and avoid introducing new top-level artifact folders.
- Default to CLI commands and workflows, not Playwright test specs.
