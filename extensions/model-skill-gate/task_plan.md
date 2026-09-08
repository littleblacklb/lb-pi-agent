# Task Plan — model-skill-gate

> 一个 pi 全局扩展：按模型（provider/model id）门控"加载哪些 skill 内容"。
> 默认规则：deepseek 家族 → 注入 superpowers（obra）引导；非 gated 模型（如 gpt-5.6 系）完全不注入、不可见。
> 会话开始时用了 gated 模型、中途切走/切入时 → 对称 notify 提醒"上下文已被/将被塑造，建议 /new"。


## Phase 7 — 需求变更：注入改为按模型门控可见性（skill 机制）

**Status:** complete

用户变更需求（验收后）：不要自动加载引导体；"还是根据 skill 机制"，仅让指定模型能看到技能。

- [x] 勘察：pi 技能目录 = system prompt 内 `<available_skills>` XML（name/description/location），会话启动烘焙一次；resources_discover 无模型概念（仅 startup/reload）；`before_agent_start` 每次用户提问触发、可返回 systemPrompt 覆盖、返回 undefined 自动复位 base → 唯一干净的按模型门控缝隙
- [x] 决策：技能留在扫描目录外（~/.pi/gated-skills），gated 模型每轮把目录条目（原生 XML）合并进现有 `<available_skills>` 块；非 gated 完全不动 base；去 marker/消息插入机制（context 只做跟踪/状态栏）
- [x] 实现：catalog.ts（条目收集 name/description/location、XML 转义、按 location 去重、合并/追加）替换 skill-loader；engine 仅留 switch 评估 + v2 可见性措辞消息；index.ts 新增 before_agent_start handler、删除 context 消息手术
- [x] 单测重写：46 通过（catalog 10 + config 11 + engine/warn 9 + matcher 13 + integration 3）；typecheck 绿
- [x] E2E：print 模式 deepseek → bas gated=true entries=14 inserted=14，模型实际列举 14 个 superpowers 技能；openai-codex/anyrouter gpt-5.6 → 无 bas 行、模型答 NONE；TUI A（deepseek→gpt 隐藏 + leave 新文案 → 切回恢复）B（gpt→deepseek enter 新文案 + 注入恢复）✓；/skill-gate 显示 14 skills visible
- [x] 清理测试会话/临时日志；README/本计划更新；models.json 未触碰

## Goal

在 pi TUI（及所有运行模式）中，让用户能配置"模型 → 注入 skill"规则：
1. 匹配 deepseek 等 gated 模型时，每一轮用户提交前把 superpowers 引导内容注入 system prompt（确定性加载）；
2. 非 gated 模型（如 anyrouter/cc-switch-micu/openai-codex 下的 gpt-5.6 系）不注入、不可见；
3. 会话以 gated 模型开始后切走 → notify：会话上下文已被 superpowers 塑造，建议 /new（纯通知，不阻断、不回退）；
4. 反向（非 gated 会话切入 gated 模型）→ 对称 notify，完整启用同样建议 /new。

## Decisions Made

| # | 决策 | 结论 | 理由 |
|---|------|------|------|
| D1 | superpowers 来源 | 执行阶段 `git clone --depth 1` obra/superpowers 到 `~/.pi/gated-skills/superpowers`（pi 扫描目录之外） | 官方 `pi install` 会注册它自己的扩展，对所有会话无条件注入，破坏门控；私有 clone 后由本插件决定注入时机 |
| D2 | 匹配语义 | 大小写不敏感；pattern 含通配符(`* ? [...]`)→ glob→regex；否则精确匹配；对 `${provider}/${id}` 与裸 `id` 两个候选串匹配 | 一条 `*deepseek*` 覆盖 provider deepseek + 任意 id 含 deepseek 的模型 |
| D3 | 注入机制 | `context` 事件（每次 LLM 调用前）把引导体作为 user 消息插入消息列表（compaction summary 之后）；gated 且消息中无标记→插入；非 gated→从发给 LLM 的消息中**移除**带标记的引导体 | 镜像 obra 官方 pi 扩展实现（.pi/extensions/superpowers.ts，v6.3.0），逐 LLM 调用生效：mid-run 切模型即时跟进；非 gated 模型连历史遗留引导体都收不到。不在 resources_discover 注册 skillPaths（官方那样做会让所有会话看到技能） |
| D4 | 注入内容 | obra 的 using-superpowers/SKILL.md 剥离 frontmatter 后正文 + 附加"技能索引"（clone skills/ 下每子技能 name+desc+绝对 SKILL.md 路径）+ 平台适配指引 | 子技能不在 pi 扫描目录，gated agent 靠索引里的绝对路径自行 read |
| D5 | 切换提醒语义 | "会话污染"模型：会话开始时模型 gated → 历史由 superpowers 塑造；切走后注入停止但历史残留 → 混合方法论。提醒 = 纯 notify + 建议 /new | 用户确认此设计合理；pi 无 model 切换前 hook（model_select 事后触发），不做阻断/回退 |
| D6 | 双向提醒 | onLeave（gated 会话切走）+ onEnter（非 gated 会话切入）对称 notify；同一会话同一方向不重复刷（coalesce）；`source==="restore"` 不提醒 | 用户选择对称；restore 是加载会话自身状态，非用户切换意图 |
| D7 | 安装位置 | 全局扩展包 `~/.pi/agent/extensions/model-skill-gate/`（package.json + pi.extensions），配置 `~/.pi/model-skill-gate.json`（缺失时写默认示例） | 与 pi-guided-plan 同模式；用户选择全局 + 全局配置 |
| D8 | UI 降级 | `ctx.hasUI === false`（-p/json/rpc）时提醒走 console，不调 ui | 扩展在 print/json 模式同样运行，必须安全 |

## Phases

### Phase 1 — 脚手架 + superpowers 安装
**Status:** complete

- [x] `~/.pi/agent/extensions/model-skill-gate/` 内建 package.json（devDeps: @earendil-works/pi-coding-agent@^0.84.4、typebox、typescript、@types/node）、tsconfig、src/ 布局；npm install；`pi --version` 启动冒烟确认扩展被加载不报错
- [x] `git clone --depth 1 https://github.com/obra/superpowers ~/.pi/gated-skills/superpowers`（先确认目录不存在再 clone）
- [x] 勘察 clone 布局：定位 using-superpowers 引导 SKILL.md、子技能目录集合、frontmatter 结构；记录到 findings.md

### Phase 2 — 核心库（纯函数 + 测试）
**Status:** complete

- [x] `src/matcher.ts`：wildcard/exact 匹配器 + 单测（deepseek/deepseek-v4-pro、anyrouter/gpt-5.6-sol、大小写、`deepseek/*`、裸 id 等用例）
- [x] `src/config.ts`：读 `~/.pi/model-skill-gate.json`（缺失写默认示例：match `["*deepseek*"]`、skill path、warn 开关、indexDirs）；schema 校验 + 友好报错 + 单测
- [x] `src/skill-loader.ts`：~ 展开、dir/SKILL.md 定位、YAML frontmatter 剥离、mtime 缓存、注入块构建（标记 + 正文 + 技能索引 + 平台说明）+ 单测
- [x] npm scripts：typecheck（tsc --noEmit）、test（vitest run）

### Phase 3 — 注入引擎 + 接线
**Status:** complete

- [x] `src/engine.ts`：模型门控消息变换（纯函数，可注入消息列表单测）：gated→无标记则插（compaction summary 后）；非 gated→移除带标记消息
- [x] `src/index.ts` 接线：`context` handler 调用变换；starter/会话状态仅用于提醒（P4）；`ctx.ui.setStatus` 显示 gated 状态（statusBar 开关）
- [x] 消息形状兼容：content 字符串/数组；只动含我们标记的消息；其余原样
- [x] 会话/文件变更重载：每次 context 前 stat 配置文件与 SKILL.md（mtime 缓存），改动即重建注入块

### Phase 4 — 对称提醒 + /skill-gate 命令
**Status:** complete

- [x] `model_select` handler：onLeave/onEnter notify 文案 + coalesce + hasUI 降级 + 单测（事件序列模拟）
- [x] `pi.registerCommand("skill-gate")`：显示 starter/current/gated/规则/配置路径/加载状态；`reload` 参数重读配置与 skill
- [x] typecheck + 全量单测绿

### Phase 5 — TUI 真机 E2E（tmux）
**Status:** complete

- [x] deepseek 会话首轮注入生效（debug 日志 + 行为/状态栏可见）
- [x] gated 会话 Ctrl+P 切到 gpt-5.6 → away notify 文案出现；继续会话不再注入（日志断言）
- [x] gpt 会话切到 deepseek → enter notify；/resume 旧 deepseek 会话 → 不误提醒
- [x] -p print 模式跑通不崩、注入按默认模型生效或安静跳过
- [x] 非 gated 会话全程无注入（日志断言），clean

### Phase 6 — 文档收尾
**Status:** in_progress

- [x] README：安装（clone + 插件放置）、配置 schema、行为说明、/skill-gate、限制（mid-run 切换下一轮生效、auto-compact 续跑间隙、notify 事后性）、卸载
- [x] 交付验收清单与用户确认（check-complete 语义）

## Out of Scope / 已知边界

- 不做 model 切换前拦截/阻断（pi 无 pre-hook）；提醒是 notify，不自动回退
- pi 自身对"扫描目录内技能"的全局列表（~/.pi/agent/skills 等）不受本插件影响；superpowers 装扫描目录外，天然只对 gated 模型可见
- 一次只注入用户配置的 skills（默认 using-superpowers 引导体，非全量子技能正文）

## Next Step

P6 收尾已完成（README/LICENSE/计划更新）。剩余：用户验收交付（check-complete 语义）；验收后无新增工作时关闭循环。

### 实施记录（执行期增量）

- P1-P5 已执行完毕：脚手架+clone(6.3.0)+勘察 → matcher/config/skill-loader（含 mtime 缓存与索引）→ engine(applyGate) + context 接线 + 状态栏 → model_select 对称提醒(纯函数 evaluateSwitchWarnings) + /skill-gate → E2E 全矩阵通过（deepseek↔gpt-5.6，print/TUI/resume/命令）。
- 关键实现细节：注入采用官方同款 context 事件 user 消息插入（compaction summary 之后），非 gated 时从消息中移除带 marker 消息；验证发现注入为逐 LLM 调用临时生效（不写回会话），切走后无残留。
- 55 个单测/集成测试 + typecheck 全绿；E2E 断言文件日志（PI_MODEL_SKILL_GATE_LOG）驱动。

