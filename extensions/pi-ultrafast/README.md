# Local Ultrafast switch

Run `/reload` after installation, then `/ultrafast on`.

- `/ultrafast on|off|toggle|status` (no argument toggles).
- Default: off. State is saved in this directory's `config.json`.
- Applies only to OpenAI/OpenAI-Codex `gpt-6-astra` and `gpt-6.1-sol`.
- Sends `service_tier: "ultrafast"`; higher usage/cost may apply.
- While enabled, overrides Fast. Turning it off restores the existing `/fast` setting, which may still be on.
- The indicator describes requested mode, not server confirmation.

This extension wraps the installed `pi-openai-fast-mode` factory and its payload hook. Its original automatic package extension loading is disabled through `settings.json` (`extensions: []`) to prevent duplicate commands. Keep that npm dependency installed. No npm package files were patched.

Test: `node ~/.pi/agent/extensions/pi-ultrafast/test.mjs`. The test uses isolated temporary state, mock command/event dispatch, and the installed host module alias. It does not send API calls or verify entitlement, actual speed, billing, or TUI rendering.

Rollback: remove this directory and restore the `npm:pi-openai-fast-mode` package entry to its original string in `settings.json`, then `/reload`.
