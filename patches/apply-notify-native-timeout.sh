#!/usr/bin/env bash
# Patch: make @pi-unipi/notify's macOS native notifications stay in Notification Center.
#
# Problem (verified 2026-09-09 on macOS 26.6.1):
#   node-notifier's mapToMac() injects `timeout: 10` whenever the caller passes
#   neither `timeout` nor `wait`, so every notification is sent as
#   `terminal-notifier ... -timeout 10 -json true`. terminal-notifier's
#   `-timeout` closes/removes the notification, and macOS then never archives it:
#   the banner pops, nothing lands in Notification Center (消息栏).
#   Direct `terminal-notifier -title ... -message ...` (no -timeout) is archived.
#
# Fix: pass `timeout: false` in platforms/native.ts, which makes node-notifier
#   delete the option, so no `-timeout` is added.
#
# Re-run this script after any `pi install` / npm update of @pi-unipi/notify.
# Revert: copy the files back from the backup dir printed below (or reinstall
#   the package: `pi install npm:@pi-unipi/notify@2.16.0`).
set -euo pipefail

PKG="${PI_NOTIFY_PKG_DIR:-$HOME/.pi/agent/npm/node_modules/@pi-unipi/notify}"
NATIVE="$PKG/platforms/native.ts"
DTS="$PKG/platforms/node-notifier.d.ts"
BACKUP_DIR="$HOME/.pi/agent/backups/$(date +%Y-%m-%d)-notify-native-timeout"

[ -f "$NATIVE" ] || { echo "error: not found: $NATIVE" >&2; exit 1; }

if grep -q "timeout: false," "$NATIVE"; then
  echo "already patched: $NATIVE"
  exit 0
fi

mkdir -p "$BACKUP_DIR"
cp -p "$NATIVE" "$DTS" "$BACKUP_DIR/"
echo "backed up: $BACKUP_DIR/{native.ts,node-notifier.d.ts}"

python3 - "$NATIVE" "$DTS" <<'PY'
import sys

native_path, dts_path = sys.argv[1], sys.argv[2]

anchor = """    notifier.notify(
      {
        title,
        message,
        appID: options?.windowsAppId,
      },"""
replacement = """    notifier.notify(
      {
        title,
        message,
        appID: options?.windowsAppId,
        // node-notifier injects `-timeout 10` when neither timeout nor wait is
        // given, and terminal-notifier's `-timeout` makes macOS show the banner
        // without archiving it in Notification Center. `false` deletes the
        // option, so the notification stays in Notification Center.
        timeout: false,
      },"""

src = open(native_path, encoding="utf-8").read()
if anchor not in src:
    sys.exit(f"error: anchor not found in {native_path} (upstream changed?)")
open(native_path, "w", encoding="utf-8").write(src.replace(anchor, replacement, 1))
print(f"patched: {native_path}")

dts = open(dts_path, encoding="utf-8").read()
if "timeout?: number | false;" not in dts:
    dts_anchor = "    wait?: boolean;"
    if dts_anchor not in dts:
        sys.exit(f"error: anchor not found in {dts_path} (upstream changed?)")
    open(dts_path, "w", encoding="utf-8").write(
        dts.replace(dts_anchor, dts_anchor + "\n    timeout?: number | false;", 1)
    )
    print(f"patched: {dts_path}")
else:
    print(f"already patched: {dts_path}")
PY

echo "done. restart pi or run /reload so the extension is re-imported."
