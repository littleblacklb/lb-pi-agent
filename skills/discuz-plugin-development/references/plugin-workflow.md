# Plugin Workflow

## When To Read This File

Read this file when you need the concrete Discuz plugin structure, entrypoints, settings layout, templates, language packs, table wrappers, or install and upgrade metadata.

## Core Setup

1. Enable plugin developer mode in `config/config_global.php` when needed:
   `$_config['plugindeveloper'] = 1;`
2. Create or identify the plugin `identifier`.
3. Create the plugin directory:
   `source/plugin/<identifier>/`

Use a stable identifier. Renaming it later usually forces path, class, hook, language, and XML changes.

## Common File Layout

```text
source/plugin/<identifier>/
  admincp.inc.php
  some-page.inc.php
  some-hook.class.php
  template/
    some-page.htm
    mobile/
      some-page.htm
  table/
    table_<table_name>.php
data/plugindata/
  <identifier>.lang.php
```

Discuz naming conventions from the official docs:

- Public scripts: `.php`
- Included modules: `.inc.php`
- Classes: `.class.php`
- Function libraries: `.func.php`
- Templates: `.htm`
- Language packs: `.lang.php`

## URL Patterns

- Frontend module:
  `plugin.php?id=<identifier>:<module>`
- Frontend module when identifier and module names are the same:
  `plugin.php?id=<identifier>`
- Admin module:
  `admin.php?action=plugins&identifier=<identifier>&pmod=<module>`

Do not build links that bypass Discuz's plugin shells unless there is a compelling reason and the user accepts the tradeoff.

## Module Types

Discuz's plugin UI supports three broad plugin module types:

- Program links:
  Navigation entries and linked pages.
- Extension items:
  Extra entries in places like personal settings, help, forum management, or admin areas.
- Program scripts:
  Hook classes for page embedding and special thread handlers.

For ordinary frontend or admin pages, `.inc.php` modules plus templates are usually enough.

## Settings And Cache

Prefer the built-in plugin settings UI unless it is genuinely insufficient. When Discuz manages plugin settings, the values are cached and cheaper to read than querying the database manually.

Typical read locations:

- `$_G['cache']['plugin'][<identifier>]`
- `$_G['cache']['forums'][fid]['plugin']`
- `$_G['group']['plugin']`

If a custom admin page writes plugin settings outside the standard plugin variable flow, make sure the final storage and cache behavior still match how the runtime expects to read them.

## Templates

- Store plugin templates in:
  `source/plugin/<identifier>/template/`
- Store mobile plugin templates in:
  `source/plugin/<identifier>/template/mobile/`

Load a plugin template in PHP with:

```php
include template('<identifier>:test');
```

Include a plugin template from another template with:

```html
{template <identifier>:test}
```

## Language Packs

During development, store the language pack at:

`data/plugindata/<identifier>.lang.php`

Expected arrays:

```php
$scriptlang['identifier'] = array();
$templatelang['identifier'] = array();
$installlang['identifier'] = array();
```

Usage:

- Script language:
  `lang('plugin/<identifier>', 'key')`
- Template language:
  `{lang <identifier>:key}`
- Install or upgrade script language:
  `$installlang['key']`

## Table Wrappers

For plugin-owned tables, add wrappers under:

`source/plugin/<identifier>/table/table_<name>.php`

Call them with:

```php
C::t('#<identifier>#<name>')
```

Prefer this over raw SQL access scattered through the plugin.

## Install, Upgrade, Uninstall

Discuz plugins can define lifecycle scripts in exported XML metadata:

- `installfile`
- `uninstallfile`
- `upgradefile`
- `checkfile`

Inside these scripts:

- `runquery()` can execute SQL.
- Tables may be written with the `cdb_` prefix in official examples.
- Set `$finish = TRUE;` when the lifecycle script is done.
- Upgrade scripts receive `$fromversion` and `$toversion`.

## Compatibility And Packaging

- Keep compatibility metadata current in the exported XML.
- If the plugin ships extra forum data such as smilies or styles, include them through the XML import metadata.
- If the plugin owns extra tables, register them in plugin management so site backups can include them.

## Safety And Maintainability

- Keep all plugin code in `source/plugin/`.
- Minimize core Discuz code changes. Prefer an external-style plugin over patching the forum itself.
- Prefer separate plugin tables instead of mutating core tables.
- Never remove core Discuz fields or indexes from standard tables.
