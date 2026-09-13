# Playwright Browser MCP — Always Prefer for Browser Work

This rule applies to **every session**. The browser-control MCP is **Playwright MCP** (`@playwright/mcp`), configured in `~/.pi/agent/mcp.json` as the MCP server named `playwright`.

## Mandatory tool routing

Whenever the user asks to do any of the following, **do not** use shell/`npx playwright` scripts, raw Chrome CDP hacks, or built-in `web_fetch` as a substitute for interactive control:

- open / control a real browser
- click, type, scroll, fill forms, submit
- take page snapshots / screenshots of a live UI
- verify UI after code changes
- navigate multi-step web flows
- extract content that needs JS rendering or authenticated pages
- generate PDF from a page
- run browser-based QA / smoke checks

**Always:**

1. Discover the tools through pi's MCP gateway first: `mcp` action `search` with a query like `playwright browser navigate snapshot click` (or the needed action).
2. Call them with the returned path: `mcp` with `tool: "playwright__browser_navigate"`, `playwright__browser_snapshot`, `playwright__browser_click`, etc., or batch navigate → snapshot → click inside one `mcpScript` block.
3. Before the first call, make sure the shared Chrome is up: run `~/.pi/agent/skills/src-hunting/bin/chrome-9222.sh` (idempotent; never kills a browser). The `playwright` and `js-reverse` MCP servers both attach to that Chrome on port 9222, so the login state is shared.
4. Prefer **accessibility snapshots** over screenshots when understanding page structure; use vision/screenshot tools when visual verification is required.
5. Keep the browser session open across multi-step tasks; do not relaunch unnecessarily.

## When NOT to use Playwright MCP

- Pure static HTTP fetch of a public URL with no interaction → built-in `web_fetch` / `web_search` is fine.
- Local file edits, git, terminal, code analysis → built-in tools only.
- The `playwright` server is missing from `~/.pi/agent/mcp.json`, or the MCP search returns no playwright tools → report that clearly and fall back.

## Auto-invocation checklist

Before answering browser-related requests with only text or shell:

- [ ] Did I search the MCP gateway for playwright tools?
- [ ] Did I use `playwright__*` tools for actual control?
- [ ] Did I avoid inventing bash one-liners to drive the browser?

If any checkbox fails and the task needs a real browser, **stop and call the MCP**.

## Session expectation

Playwright MCP is **always enabled** in `~/.pi/agent/mcp.json` as the server `playwright` (launched as `npx -y @playwright/mcp@latest --cdp-endpoint http://127.0.0.1:9222 --caps=vision,pdf`). It attaches to the shared Chrome instead of launching its own profile; if port 9222 is not answering, run `~/.pi/agent/skills/src-hunting/bin/chrome-9222.sh` first. Treat it as a first-class tool path, not an optional plugin the user must re-enable each time.
