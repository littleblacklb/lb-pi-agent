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
2. Call them with the returned path: `mcp` with `tool: "playwright_browser_navigate"`, `playwright_browser_snapshot`, `playwright_browser_click`, etc., or batch navigate → snapshot → click inside one `mcpScript` block.
3. Before the first call, make sure the shared Chrome is up: run `~/.pi/agent/skills/src-hunting/bin/chrome-9222.sh` (idempotent; never kills a browser; 直接执行该路径即可——写成 `bash <path>` 会命中 pi 的 `bash *` = ask 规则而多弹一次审批). The `playwright` and `js-reverse` MCP servers both attach to that Chrome on port 9222, so the login state is shared.
4. Prefer **accessibility snapshots** over screenshots when understanding page structure; use vision/screenshot tools when visual verification is required.
5. Keep the browser session open across multi-step tasks; do not relaunch unnecessarily.

## When NOT to use Playwright MCP

- Pure static HTTP fetch of a public URL with no interaction → built-in `web_fetch` / `web_search` is fine.
- Local file edits, git, terminal, code analysis → built-in tools only.
- The `playwright` server is missing from `~/.pi/agent/mcp.json`, or the MCP search returns no playwright tools → report that clearly and fall back.

## Auto-invocation checklist

Before answering browser-related requests with only text or shell:

- [ ] Did I search the MCP gateway for playwright tools?
- [ ] Did I use `playwright_*` tools for actual control?
- [ ] Did I avoid inventing bash one-liners to drive the browser?

If any checkbox fails and the task needs a real browser, **stop and call the MCP**.

## Session expectation

Playwright MCP is **always enabled** in `~/.pi/agent/mcp.json` as the server `playwright` (launched as `npx -y @playwright/mcp@latest --cdp-endpoint http://127.0.0.1:9222 --output-dir /Users/lb/Library/Caches/pi-playwright/output --caps=vision,pdf`). It attaches to the shared Chrome instead of launching its own profile; if port 9222 is not answering, run `~/.pi/agent/skills/src-hunting/bin/chrome-9222.sh` first. Treat it as a first-class tool path, not an optional plugin the user must re-enable each time.

## 实测事实（2026-09-14 本机验证，优先于本文档推测）

- 工具真实名字是**单下划线**：`playwright_browser_navigate`、`playwright_browser_snapshot`、`playwright_browser_click`、`playwright_browser_network_requests` 等（本机实测 31 个工具），调用写法 `mcp({ tool: "playwright_browser_navigate", args: { url: "..." } })`。
- 同族浏览器 MCP：`js-reverse`（24 工具，名形如 `js-reverse_list_network_requests`、`js-reverse_search_in_sources`、`js-reverse_get_websocket_messages`、`js-reverse_select_page`）。`js-reverse_evaluate_script` 执行任意 JS 需 `confirm=true`。调试器/XHR 断点类工具跑在同一只 9222 Chrome 上，与 playwright 共享页面与登录态（实测：playwright 打开的页面在 js-reverse 的 `select_page` 里可见且能抓到它的网络请求）。
- 输出落点：`--output-dir` 就是输出根目录（源码：`options.config.outputDir` 优先，否则 `<cwd>/.playwright-mcp`）。改 `~/.pi/agent/mcp.json` 的参数**要重启 pi 才生效**（运行中的 server 进程仍是旧参数，可用 `ps -eo pid,command | rg playwright/mcp` 核对）。工具返回文本里的相对路径 `.playwright-mcp/xxx.yml` 是固定文案，别用它判断真实落点。
- 需要把快照/console 当证据留档时，从输出目录拷进任务目录的 `{名}_dig/`。
