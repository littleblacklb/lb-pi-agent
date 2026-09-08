# Camoufox Escalation Reference

Camoufox is an open-source anti-detect Firefox build (MPL-2.0) designed for AI
agents and scraping. Fingerprint spoofing (navigator, screen, WebGL, fonts,
WebRTC, timezone, locale, headers) happens at the C++ level, not via JS
injection, so it is much harder for anti-bot systems to detect than
playwright-cli's plain Chromium.

`camoufox-js` is Apify's JavaScript client for Camoufox — a port of the Python
wrapper. As of camoufox-js 0.12.0 the npm description marks it **"Experimental"**:
expect API churn and version-skew sensitivity across upgrades.

## Why a separate driver

playwright-cli can only attach to browsers over CDP (Chromium). Camoufox is a
Firefox build speaking the Juggler protocol, so it needs its own Node driver:
`scripts/camoufox_run.mjs`. Do not try to route Camoufox through playwright-cli.

## Install (driver does this automatically on first run)

```bash
npm install --no-audit --no-fund camoufox-js playwright-core
npx camoufox-js fetch   # downloads the browser (~200MB) into ~/.cache/camoufox
```

`CAMOUFOX_INSTALL_DIR` overrides the browser location (useful in containers/CI,
like `PLAYWRIGHT_BROWSERS_PATH`).

## Direct API (when the driver is not enough)

```js
import { launchOptions } from "camoufox-js";
import { firefox } from "playwright-core";

const browser = await firefox.launch({
  ...(await launchOptions({
    headless: true,        // defaults to false (headed)
    os: "windows",         // "windows" | "macos" | "linux" | list to pick from
    humanize: true,        // human-like cursor movement
    geoip: true,           // derive timezone/locale/geolocation from exit IP
    proxy: "http://user:pass@host:port",  // string or Playwright proxy object
    disable_coop: true,    // allows clicking cross-origin iframes (Turnstile)
    i_know_what_im_doing: true, // suppresses the disable_coop leak warning
  })),
});

const page = await browser.newPage();
await page.goto("https://example.com");
```

Notes:

- `i_know_what_im_doing` is snake_case; the camelCase variant is ignored and
  the leak warning will print.
- `geoip: true` makes a request through the proxy to discover the exit IP.
  Without a proxy it uses the machine's own IP.
- All standard Playwright launch/page APIs work (the browser instance is a
  normal Playwright `Browser`).

### Server mode (share one browser across processes/languages)

```js
import { launchServer } from "camoufox-js";
import { firefox } from "playwright-core";

const server = await launchServer({ port: 8888, ws_path: "/camoufox" });
const browser = await firefox.connect(server.wsEndpoint());
```

A server holds one browser instance, so fingerprints do NOT rotate between
sessions. Prefer direct `firefox.launch()` per session (driver default).

## Options quick reference

| Option | Meaning |
| --- | --- |
| `os` | Fingerprint OS; default random from windows/macos/linux |
| `humanize` | `true` or max cursor-move duration in seconds |
| `geoip` | Match timezone/locale/geolocation to the exit IP |
| `proxy` | Proxy URL string or Playwright proxy object |
| `locale` | e.g. `"en-US"`, `"US"`, or list |
| `window` | Fixed `[width, height]`; avoid for production (fingerprintable) |
| `block_images` | Save proxy bandwidth |
| `block_webrtc` | Block WebRTC entirely |
| `disable_coop` | Allow clicking cross-origin iframe widgets (Turnstile) |
| `fonts` | Extra font families (must be installed on the system) |
| `headless` | `true`, `false` (default), or `"virtual"` (Xvfb on Linux) |

## Verified behavior (camoufox-js 0.12.0, 2026-08)

- Fingerprints rotate per launch: OS/platform, screen size, hardware
  concurrency all vary; `navigator.webdriver` reports `false`; UA is realistic.
  (UA string stays on the actual browser build, e.g. `rv:152.0` — correct.)
- Standard Playwright flows (goto, evaluate, screenshot, innerText) work.
- Cloudflare "Just a moment..." challenge: did NOT clear in headless mode after
  30s, including with `disable_coop` + `humanize` + a Turnstile checkbox click
  on a demo page. Headed mode and/or a clean exit IP may clear it, but treat
  Cloudflare success as unverified. Do not promise the user that Camoufox
  bypasses Cloudflare.

## Known risks

- **Experimental status**: API can change between versions.
- **Version skew**: Camoufox releases are tied to a specific Juggler protocol
  version. camoufox-js pins a compatible playwright-core, but re-check on
  upgrades (`npm outdated`).
- **Fingerprint leakage**: passing explicit `os`/`window`/`webgl_config` that
  are internally inconsistent produces warnings — respect them.
- **Server mode**: no per-session fingerprint rotation; scale by launching
  multiple servers/browsers.
