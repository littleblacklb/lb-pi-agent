---
name: discuz-plugin-development
description: Develop, scaffold, debug, review, or extend Discuz!/Discuz X plugins. Use when a task involves source/plugin/*, plugin.php or admin.php plugin entrypoints, hook classes, special thread plugins, plugin install or upgrade scripts, plugin templates, language packs, or plugin table wrappers.
---

# Discuz Plugin Development

Use this skill when working on plugin code in a Discuz codebase. Prefer local repo conventions when they conflict with generic documentation, but keep Discuz's plugin entrypoints, file layout, guards, and hook naming intact.

## Default Workflow

1. Inspect the target repo before writing code.
   Search `source/plugin/`, `source/class/`, existing table wrappers, and similar plugins before deciding the structure.
2. Choose the smallest plugin shape that fits the task.
   Use a module page for standalone UI flows, a hook class for page injection, a special thread class for a custom thread type, or one of Discuz's extension classes when the task is specifically ads, magic, tasks, secqaa, or seccode.
3. Keep plugin code under `source/plugin/<identifier>/`.
   Avoid adding directly browsable custom entry scripts outside Discuz's plugin shell.
4. Route requests through Discuz's shells.
   Frontend plugin modules should normally be reached through `plugin.php?id=<identifier>:<module>`. Admin modules should normally be reached through `admin.php?action=plugins&identifier=<identifier>&pmod=<module>` or the equivalent generated admin URL.
5. Use the correct file types and guards.
   Directly browsable scripts use `.php`, included modules usually use `.inc.php`, hook classes use `.class.php`, helper functions use `.func.php`, templates use `.htm`.
6. Prefer built-in plugin settings and cached reads over custom config storage.
   Read plugin variables from cache whenever possible instead of querying plugin settings tables manually.
7. Add install, upgrade, or uninstall scripts only when data schema or persisted setup requires them.
8. Verify the user-facing path and the admin path you changed.

## Hard Rules

- Frontend plugin scripts must start with:
  `if(!defined('IN_DISCUZ')) { exit('Access Denied'); }`
- Admin plugin scripts must start with:
  `if(!defined('IN_DISCUZ') || !defined('IN_ADMINCP')) { exit('Access Denied'); }`
- Do not bypass `plugin.php` or `admin.php` with ad hoc public PHP endpoints unless the user explicitly needs a nonstandard integration and the risk is understood.
- Keep plugin-specific templates in `source/plugin/<identifier>/template/`. Mobile templates belong in `source/plugin/<identifier>/template/mobile/`.
- While developing language packs, use `data/plugindata/<identifier>.lang.php`.
- Prefer separate plugin tables over modifying Discuz core tables. If you must add plugin tables, also add the matching table wrapper under `source/plugin/<identifier>/table/`.
- If the repo already contains an existing plugin for the same feature area, mirror its structure instead of inventing a new architecture.

## Decision Guide

- Need a standalone frontend settings page or AJAX endpoint:
  Create a plugin module such as `memcp.inc.php` or `switch.inc.php` and route it through `plugin.php?id=<identifier>:<module>`.
- Need a backend management page:
  Add an admin module and implement `<module>.inc.php`.
- Need to inject buttons, links, or markup into existing Discuz pages:
  Use a hook class in `<module>.class.php`.
- Need a custom posting flow with extra fields and thread rendering:
  Use a special thread plugin.
- Need ad or platform-level extension points:
  Use the dedicated class types in `source/class/adv/`, `magic/`, `task/`, `secqaa/`, or `seccode/` only if the task truly belongs there.

## Data And Settings

- Plugin variables from the built-in plugin settings UI are usually available in `$_G['cache']['plugin'][<identifier>]`.
- Forum-scoped plugin variables are stored under `$_G['cache']['forums'][fid]['plugin']`.
- User-group-scoped plugin variables are exposed through group caches such as `$_G['group']['plugin']`.
- For plugin-owned tables, prefer Discuz table wrappers and call them with `C::t('#<identifier>#<table_without_prefix>')`.

## Hooks And Thread Types

- For hook naming rules and discovery, read `references/hooks-and-lifecycle.md`.
- For plugin structure, settings, templates, language packs, install scripts, and URL patterns, read `references/plugin-workflow.md`.

## Implementation Notes

- Keep the first implementation monolithic and explicit unless the repo already uses a richer internal abstraction.
- If the task depends on a specific hook point, inspect similar plugins and confirm the hook name before coding.
- If docs and repo behavior disagree, trust the running codebase and adjust the plugin shape to match local conventions.
