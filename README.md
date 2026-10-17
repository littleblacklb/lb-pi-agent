# 我的 Pi 配置备份（macOS）

这是个人 `~/.pi/agent` 的配置与工具备份，附中文分享/迁移指南，供朋友及其 Agent **按功能选择性采用**。它不是通用发行版、完整环境镜像或一键初始化工具。

仅以 **macOS** 为目标；其他平台需额外适配，尤其是通知、浏览器和路径。当前只做了静态依赖核对，**未验证新机器安装或跨平台运行**。

## 从哪里开始

1. 阅读 [迁移指南](docs/migration.md)：确认目标目录、已有配置、功能选择和授权，再预览变更。
2. 对照 [依赖清单](docs/dependencies.md)：区分仓库源码、npm 包、CLI、外部技能和需要自行认证的服务。
3. 保留已有配置，逐组安装/合并/验证；不要把整个仓库覆盖到 `~/.pi/agent`。

给接收方 Agent 的提示：

> 我希望在 macOS 上选择性采用这份 Pi 配置。请先读 `docs/migration.md` 和 `docs/dependencies.md`，询问缺失参数并给出变更预览；未经确认不要安装、覆盖、启用禁用资源或执行补丁。不要复制作者凭据、信任记录、会话或缓存。

## 仓库内外边界

| 仓库中提供 | 不随克隆提供或不能直接复用 |
|---|---|
| `AGENTS.md`、`APPEND_SYSTEM.md`：个人行为偏好 | 接收方应选择性合并，不默认接受全部全局规则 |
| `settings.json`、`mcp.json`、`pi-switch.json`、`open-tui.json`、`subagents.json` | Pi 本体、npm 包安装内容、服务认证、浏览器状态 |
| `extensions/` 中已跟踪的源码与部分插件配置 | `node_modules/`、外部工具、未跟踪的本机扩展状态 |
| `skills/` 中已跟踪的技能、脚本与四个符号链接 | 链接指向的 `~/.agents/skills/` 内容及其他外部技能 |
| `scripts/`、`patches/`、历史 `plans/` | 脚本依赖、补丁适用性保证；历史计划不是安装步骤 |

`trust.json` 不在版本库中；凭据文件（如 `auth.json`、`models.json`、`models-store.json`）、`mcp-oauth/`、`sessions/`、`state/`、`npm/`、`bin/`、`backups/` 等由 [`.gitignore`](.gitignore) 排除。**忽略规则不是脱敏保证**：已跟踪配置仍有个人路径/模型选择，未跟踪文件也不一定都被忽略。

`extensions/pi-guided-plan/` 当前没有被跟踪且配置仍排除它；不要根据旧说明自动下载或启用。

## 维护此备份

只暂存明确要分享的文件，提交前检查完整差异与敏感信息：

```bash
git -C ~/.pi/agent status --short
git -C ~/.pi/agent add -- README.md docs/migration.md docs/dependencies.md AGENTS.md
git -C ~/.pi/agent diff --cached --name-only
git -C ~/.pi/agent diff --cached
# 确认只有预期内容后再本地提交；不要 git add .
```

包版本只是核对时的快照，不保证完全复现；迁移不会默认升级 Pi 或改写锁定策略。通知补丁另见 [说明](patches/README.md)，必须先检查适用条件并单独确认。
