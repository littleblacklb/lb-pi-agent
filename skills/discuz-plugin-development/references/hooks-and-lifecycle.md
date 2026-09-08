# Hooks And Lifecycle

## When To Read This File

Read this file when the task involves page embedding, hook discovery, mobile hooks, special thread types, or return-value rules for hook methods.

## Hook Class Naming

Discuz hook classes are convention-driven.

- Global desktop hook class:
  `plugin_<identifier>`
- Script-scoped desktop hook class:
  `plugin_<identifier>_<CURSCRIPT>`
- Global mobile hook class:
  `mobileplugin_<identifier>`
- Script-scoped mobile hook class:
  `mobileplugin_<identifier>_<CURSCRIPT>`

`CURSCRIPT` is the current script name without `.php`, for example `forum`.

## Hook Method Naming

Common patterns:

- `<HookId>()`
  Called before module execution in the script-scoped hook class.
- `<HookId>_output($data)`
  Called after module execution and before template output in the script-scoped hook class.
- `global_<HookId>()`
  Called after module execution and before template output in the global hook class.
- `common()`
  Runs before all modules in the global hook class.

Some extension points also use other special method names such as:

- `discuzcode($data)`
- `deletethread($data)`
- `deletepost($data)`
- `avatar($data)`
- `ad_<adId>($data)`

## Hook Discovery

To inspect predefined hook locations from the running forum:

1. Set plugin developer mode to:
   `$_config['plugindeveloper'] = 2;`
2. Refresh cache.
3. View page source and search for `<hook>`.

If a task is tied to a hook but the exact hook is unclear, inspect both the local templates and similar plugins before implementing.

## Return Values

- String hooks usually return HTML fragments.
- Array hooks usually return an array of fragments or items for the target slot.
- If an array hook has no items, return `array()` instead of an empty string.

## High-Value Hook Areas

The official docs list many hooks, but these are common targets:

- Global header and footer:
  `global_header`, `global_footer`, `global_footerlink`
- User navigation:
  `global_usernav_extra1`, `global_usernav_extra2`, `global_usernav_extra3`
- Forum display:
  `forumdisplay_top`, `forumdisplay_bottom`, `forumdisplay_thread`, `forumdisplay_postbutton_top`
- View thread:
  `viewthread_top`, `viewthread_bottom`, `viewthread_posttop`, `viewthread_postbottom`, `viewthread_postfooter`
- Post editor:
  `post_top`, `post_bottom`, `post_btn_extra`
- Login and register:
  `global_login_extra`, `logging_top`, `register_top`
- Mobile:
  `global_header_mobile`, `global_footer_mobile`, `forumdisplay_top_mobile`, `viewthread_posttop_mobile`

## Special Thread Plugins

Use a special thread plugin when the forum needs a custom thread type with extra create, edit, or render logic.

Expected class:

```php
class threadplugin_<identifier> {
}
```

Lifecycle methods from the official docs:

- `newthread($fid)`
  Return extra form HTML for thread creation.
- `newthread_submit($fid)`
  Validate submitted data.
- `newthread_submit_end($fid, $tid)`
  Persist extra data after thread creation.
- `editpost($fid, $tid)`
  Return extra form HTML for editing.
- `editpost_submit($fid, $tid)`
  Validate edit submission.
- `editpost_submit_end($fid, $tid)`
  Persist edited extra data.
- `newreply_submit_end($fid, $tid)`
  React to replies when needed.
- `viewthread($tid)`
  Return extra output for the thread view.

## Other Discuz Extension Class Types

Discuz also supports convention-based extension classes outside `source/plugin/` for:

- Ads:
  `source/class/adv/adv_<name>.php`
- Magic:
  `source/class/magic/magic_<name>.php`
- Tasks:
  `source/class/task/task_<name>.php`
- Security questions:
  `source/class/secqaa/secqaa_<name>.php`
- Seccode:
  `source/class/seccode/seccode_<name>.php`

Only use these when the task truly belongs to that subsystem. For normal plugin feature work, stay inside `source/plugin/<identifier>/`.
