# Progress — model-skill-gate

## Session 2026-01-31（计划阶段）

- 需求调研完成：pi 0.84.4 扩展 API（model_select / before_agent_start / session_start / setModel / ui 能力）、技能发现机制、本机模型清单、obra/superpowers 官方 pi 支持方式。
- 与用户 grilling 落定 8 项决策（D1-D8，见 task_plan.md Decisions）：私有 clone 安装、通配+精确匹配、before_agent_start 注入引导体、污染语义纯通知提醒（双向对称、restore 不提醒）、全局扩展+全局配置、UI 降级规则。
- 计划文件就绪：task_plan.md（6 个 Phase）+ findings.md + 本文件。
- 用户已批准计划（approval gate 通过）。

## 进行中

- 待执行 Phase 1：脚手架 + npm install + clone obra/superpowers。

## Session 2026-09-03（执行：P1-P6 主体）

- P1 完成：package.json/tsconfig/src 脚手架（devDeps @earendil-works/pi-coding-agent@^0.84.4 等），npm install OK；obra/superpowers v6.3.0 clone 至 ~/.pi/gated-skills/superpowers；勘察官方 pi 扩展实现（context 事件插 user 消息引导体，resources_discover 注册全量技能）→ 定稿注入设计（镜像官方 + 模型门控 + 不注册技能发现）。
- P2 完成：matcher（glob/exact，大小写不敏感，provider/id + 裸 id）、config（默认写入 ~/.pi/model-skill-gate.json，schema 校验友好报错）、skill-loader（frontmatter 剥离、mtime 缓存、indexSkills 双 mtime 缓存、注入块构建）——13+11+13 单测。
- P3 完成：engine.applyGate 纯变换（gated→插 compaction 后；非 gated→移除 marker 消息；dedupe）+ context 接线 + statusBar ⚡；engine 9 用例。
- P4 完成：evaluateSwitchWarnings 纯函数（leave/enter，once-per-direction，warn 开关）+ model_select 接线 + /skill-gate 命令（status/reload）+ warn 6 用例；可选文件日志（PI_MODEL_SKILL_GATE_LOG）与 DEBUG env。
- P5 E2E 全矩阵通过（tmux + 文件日志断言）：A) deepseek 首轮注入 changed=yes + 切走 leave warn（文案含 /new）；B) gpt 会话 3× changed=no 无注入 → 切入 deepseek enter warn → 注入恢复 → 切回 gpt 静默且无残留；C) resume gpt 会话无噪音；D) /skill-gate 状态命令；print 模式 gated/非 gated 冒烟；状态栏 ⚡ 显隐。已清理测试会话与临时日志。
- 集成测试（integration.test.ts，真实 clone 存在时运行）3 用例通过；npm run check 全绿（55 tests）。
- P6：README（安装/配置/行为/命令/限制/卸载）+ LICENSE 就绪；task_plan 状态更新。models.json 未被动过（mtime Aug 31，权限策略保护路径）。
- 待办：用户验收交付确认。
- 用户验收通过（交付确认）。计划闭环完成。

## Session 2 2026-09-03（需求变更：可见性门控，v0.2）

- 用户验收 v0.1 后变更需求：去掉自动加载，改用 pi skill 机制——仅指定模型能看到技能。
- 勘察结论：skills XML 烘焙于会话启动的 base prompt；resources_discover 无模型概念；before_agent_start（每用户轮次）可返回 systemPrompt，undefined 自动复位 → 每轮按模型合并/不合并。
- v0.2：技能留在 ~/.pi/gated-skills（扫描目录外），catalog.ts 生成原生 <available_skills> 条目（name/description/location）合并进 gated 模型的 prompt；非 gated 用纯净 base；删除 context 消息 marker 注入机制；切换提醒改为可见性措辞（leave/enter，once-per-direction 不变）；/skill-gate 显示可见技能数。
- 46 单测/集成全绿；E2E：deepseek 实际列举 14 个技能、gpt-5.6 两 provider 答 NONE、TUI 会话内双向切换即时翻转 + 新文案提醒、/skill-gate OK。
- 待办：用户验收 v0.2。
- 用户验收通过 v0.2（可见性门控）。需求闭环完成。
