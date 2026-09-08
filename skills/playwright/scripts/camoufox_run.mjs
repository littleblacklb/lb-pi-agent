#!/usr/bin/env node
/**
 * Camoufox escalation driver for the playwright skill.
 *
 * Opens a URL in the Camoufox anti-detect browser (Firefox-based) when a site
 * blocks the regular playwright-cli flow (HTTP 403, Cloudflare "Just a moment...",
 * captchas, anti-bot walls). Camoufox injects realistic device fingerprints at
 * the C++ level (no JS injection), so automation is much harder to detect.
 *
 * Usage:
 *   node camoufox_run.mjs <url> [options]
 *
 * Options:
 *   --os <windows|macos|linux>   fingerprint OS (default: random per launch)
 *   --headed                     run with a visible window (default: headless)
 *   --geoip                      match timezone/locale to the exit IP (use with --proxy)
 *   --proxy <url>                e.g. http://user:pass@host:port
 *   --wait <ms>                  extra wait after the page loads
 *   --screenshot <path>          save a screenshot
 *   --js <expr>                  evaluate a JS expression and print the JSON result
 *
 * First run installs camoufox-js + playwright-core into this scripts dir and
 * downloads the Camoufox browser (~200MB) into ~/.cache/camoufox (or
 * $CAMOUFOX_INSTALL_DIR). Prints the page title and body text on success.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEPS_DIR = resolve(SCRIPT_DIR, "node_modules");
const CAMOUFOX_BIN = resolve(DEPS_DIR, "camoufox-js/dist/__main__.js");

// Mirror camoufox-js's userCacheDir() so the first-run check matches reality:
// win -> AppData/Local/camoufox/camoufox/Cache, mac -> ~/Library/Caches/camoufox,
// else -> ~/.cache/camoufox. CAMOUFOX_INSTALL_DIR always wins.
const platform = process.platform;
const userCacheDir =
	platform === "win32"
		? resolve(homedir(), "AppData", "Local", "camoufox", "camoufox", "Cache")
		: platform === "darwin"
			? resolve(homedir(), "Library", "Caches", "camoufox")
			: resolve(homedir(), ".cache", "camoufox");
const BROWSER_DIR = process.env.CAMOUFOX_INSTALL_DIR || userCacheDir;

if (!existsSync(resolve(DEPS_DIR, "camoufox-js"))) {
	console.error(
		"First run: installing camoufox-js + playwright-core into the skill scripts dir...",
	);
	execFileSync("npm", ["install", "--prefix", SCRIPT_DIR, "--no-audit", "--no-fund", "camoufox-js", "playwright-core"], {
		stdio: "inherit",
	});
}

if (!existsSync(BROWSER_DIR)) {
	console.error(
		`First run: downloading the Camoufox browser (~200MB) into ${BROWSER_DIR}...`,
	);
	execFileSync("node", [CAMOUFOX_BIN, "fetch"], { stdio: "inherit" });
}

const { launchOptions } = await import("camoufox-js");
const { firefox } = await import("playwright-core");

const args = process.argv.slice(2);
const url = args.find((arg) => !arg.startsWith("--"));
const flag = (name) => {
	const index = args.indexOf(`--${name}`);
	return index >= 0 ? args[index + 1] : undefined;
};
const has = (name) => args.includes(`--${name}`);

if (!url) {
	console.error("Usage: node camoufox_run.mjs <url> [--os ...] [--headed] [--geoip] [--proxy ...] [--wait ms] [--screenshot path] [--js expr]");
	process.exit(2);
}

const browser = await firefox.launch({
	...(await launchOptions({
		headless: !has("headed"),
		...(flag("os") ? { os: flag("os") } : {}),
		...(has("geoip") ? { geoip: true } : {}),
		...(flag("proxy") ? { proxy: flag("proxy") } : {}),
		humanize: true,
		disable_coop: true,
		i_know_what_im_doing: true,
	})),
});

try {
	const page = await browser.newPage();
	await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
	if (flag("wait")) {
		await page.waitForTimeout(parseInt(flag("wait"), 10));
	}
	if (flag("screenshot")) {
		await page.screenshot({ path: flag("screenshot") });
	}
	if (flag("js")) {
		console.log("JS:", JSON.stringify(await page.evaluate(flag("js"))));
	}
	console.log("TITLE:", await page.title());
	const text = await page.locator("body").innerText();
	console.log("BODY:", text.slice(0, 4000));
} finally {
	await browser.close();
}
