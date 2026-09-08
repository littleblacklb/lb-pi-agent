# 本地补丁（node_modules 内，重装包后需重跑）

| 脚本 | 目标 | 原因 | 生效方式 |
|---|---|---|---|
| `apply-notify-native-timeout.sh` | `@pi-unipi/notify/platforms/native.ts` | node-notifier 自动注入 `-timeout 10`，导致 macOS 只弹横幅、不归档进消息栏 | 跑脚本后 `/reload` 或重启 pi |

备份目录：`~/.pi/agent/backups/<日期>-notify-native-timeout/`
验证：`terminal-notifier -list ALL` 应能看到刚发的通知标题。
