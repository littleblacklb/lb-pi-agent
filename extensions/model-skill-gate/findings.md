# Findings — model-skill-gate

## pi 扩展机制（docs: extensions.md / skills.md，pi 0.84.4）

- 扩展位置：`~/.pi/agent/extensions/*.ts` 或 `~/.pi/agent/extensions/<name>/{index.ts | package.json pi.extensions}`；经 jiti 加载 TS，工厂函数默认导出，可 async。
- 事件（均验证存在于 0.84.4 类型 core/extensions/types.d.ts）：
  - `model_select`：`{ model, previousModel?, source: "set"|"cycle"|"restore" }`；`/model`、Ctrl+L 选择器、Ctrl+P 循环、会话恢复都会触发；**事后**触发，无 veto/pre 钩子。
  - `before_agent_start`：用户提交 prompt 后、agent loop 前；可 return `{ systemPrompt: 链式原串+追加 }` 或 `{ message }`；`event.systemPromptOptions.skills` 只读。
  - `session_start { reason: "startup"|"new"|"resume"|"fork", previousSessionFile? }`；`session_shutdown`、`resources_discover`。
- ExtensionContext：`ctx.model`（当前模型，含 provider/id）、`ctx.modelRegistry`、`ctx.ui.{notify,confirm,select,setStatus,setWidget,...}`、`ctx.hasUI`（tui/rpc true；print/json false）、`ctx.sessionManager.getBranch()`、`ctx.mode`（"tui"|"rpc"|"json"|"print"）。
- `pi.setModel(model)`：设当前模型，返回 false=无 key；`pi.registerCommand`、`pi.registerShortcut`、`pi.setActiveTools`。
- ctx.newSession/switchSession 等仅 ExtensionCommandContext（命令 handler），事件 handler 内不可用 → 无法在 model_select 里自动 /new。
- 技能发现目录（skills.md）：`~/.pi/agent/skills/`、`~/.agents/skills/`、项目 `.pi/skills`（trusted）、settings `skills` 数组、CLI `--skill`、包内 skills/。系统提示每会话列出全部发现技能的 name+description（XML），**无按模型过滤机制** → 按模型门控必须走 system prompt 注入。
- skill 加载约定：模型用 read 读 SKILL.md 全文；相对路径相对 skill 目录解析。注入文本必须显式给出绝对 root 才能让 agent 正确按相对引用读取子文件。
- 快捷键（keybindings.md）：`app.model.select` = ctrl+l，`app.model.cycleForward` = ctrl+p，`app.model.cycleBackward` = shift+ctrl+p。

## 本机环境事实

- pi 版本 0.84.4（/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent）。
- 现有扩展模式参照 `~/.pi/agent/extensions/pi-guided-plan/`：package.json `{ pi: { extensions: ["./src/index.ts"] }, devDeps: @earendil-works/*@^0.84.4 + typebox + typescript + vitest }`，`type: module`，engines node>=22。
- 可用模型（pi --list-models）：deepseek/deepseek-v4-flash、deepseek/deepseek-v4-pro、deepseek/deepseek-v4-flash-vision-exp；anyrouter、cc-switch-micu、openai-codex 下多个 gpt-5.6 系（gpt-5.6-sol/luna/terra 等）→ E2E 用 deepseek-v4-pro ↔ gpt-5.6-sol。
- superpowers 未安装：`~/.claude/skills/` 下 26 个 symlink（brainstorming、using-superpowers、test-driven-development 等）指向 `~/.agents/skills/<name>`，目标目录不存在（失效链接）。说明用户曾装过 obra/superpowers 全家桶（Claude Code 布局），现机器上无真实技能。

## obra/superpowers 官方 pi 支持（README.md@main，clone v6.3.0 已验证）

- 官方安装：`pi install git:github.com/obra/superpowers`。package.json `pi.extensions: ["./.pi/extensions/superpowers.ts"]`，`pi.skills: ["./skills"]`。
- **官方注入实现（.pi/extensions/superpowers.ts，直接镜像）：**
  - resources_discover 注册 skillPaths=skillsDir（让所有会话技能可见——我们不注册）。
  - `context` 事件：若消息列表无引导体标记 → 把 `user` 角色的引导消息插入到开头 compactionSummary（role=="compactionSummary"）之后；去重靠全文 marker 扫描；injectBootstrap 标志 session_start/session_compact 重置、agent_end 清除（官方仅首 run + compact 后注入，非每 run）。
  - 引导体 = 剥离 frontmatter 的 `skills/using-superpowers/SKILL.md` + `<EXTREMELY_IMPORTANT>` 框 + piToolMapping 附录。
- skills/ 下 14 个子技能目录（brainstorming、dispatching-parallel-agents、executing-plans、finishing-a-development-branch、receiving-code-review、requesting-code-review、subagent-driven-development、systematic-debugging、test-driven-development、using-git-worktrees、using-superpowers、verification-before-completion、writing-plans、writing-skills），均有 name/description frontmatter；SKILL.md 正文 3-15KB。using-superpowers 正文 3108B/63 行（含 Platform Adaptation 指向 references/pi-tools.md）。
- 仓库 clone 于 ~/.pi/gated-skills/superpowers（扫描目录外，不注册即对所有模型不可见）。

## model-skill-gate 注入设计定稿（基于官方实现）

- context 事件注入 user 消息（compaction 后插入），按模型门控：
  - gated 且无标记 → 插入（引导体正文 + 技能索引 + 平台说明）；
  - 非 gated → 从发给 LLM 的消息列表移除所有带我们标记的消息（历史残留也不送达）。
  - 标记须与官方区分（官方 marker: "superpowers:using-superpowers bootstrap for pi"；我们用独立 marker，避免误删官方消息/互插）。
- 消息形状兼容：content 为 string 或 [{type:text,text}] 数组；只变换含标记的消息。
- 不注册 skillPaths；技能索引给出 skills/<name>/SKILL.md 绝对路径，agent 自行 read。

## 设计探索记录

- 方案 A（否决）：pi 官方包安装 + 在非 gated 会话"摘除"其注入 —— 扩展链顺序不可控，脆弱。
- 方案 B（否决）：resources_discover 按会话加 skillPaths —— 只在 session start/reload 触发，跟不上会话中途 model 切换；且只能加不能减。
- 方案 C（采纳）：私有 clone + before_agent_start 按 ctx.model 注入引导体 + 绝对路径子技能索引；model_select 事后对称 notify（污染语义）。
