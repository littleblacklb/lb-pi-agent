# 依赖映射与版本快照

[返回 README](../README.md) · [迁移流程](migration.md)

核对基线：2026-10-18 迁移文档任务，作者本机 Pi **1.3.0**；来源是已跟踪配置、已安装包的 `package.json`、相关源码与本机官方文档。**不是锁文件、完整软件物料清单或干净机器测试报告。** 没有安装、升级、调用服务或读取认证文件。

## 1. npm 功能组

下表覆盖 `settings.json` 的全部 **24 项** npm 声明。安装源为 `npm:<包名>`；只有“声明固定”行在源后附带 `@版本`，其他版本都是本机快照，不能解释为已锁定。按功能选择，不要求整组全装。

| 功能组 | 包名 | 本机版本 | 声明/额外条件 |
|---|---|---|---|
| 上下文 | `pi-observational-memory` | 3.1.4 | 独立记忆模型与认证 |
| 讨论 | `@paulmupeters/pi-brainstorm` | 0.1.3 | 对话式 brainstorm |
| MCP | `pi-mcp-adapter` | 5.3.2 | 服务器/CLI/认证另备；原生 MCP 被排除 |
| 联网搜索 | `@tavily/pi-extension` | 0.1.2 | 接收方 Tavily 认证 |
| 界面 | `pi-open-tui` | 0.3.11 | 对应 `open-tui.json` |
| 界面 | `@firstpick/pi-themes-bundle` | 0.1.7 | 主题按需选择 |
| 文件检索 | `@ff-labs/pi-fff` | 0.11.0 | `extensions: ["+src/index.ts"]`；平台相关依赖需验证 |
| 交互 | `@juicesharp/rpiv-ask-user-question` | 2.13.9 | 结构化问卷 |
| 通知 | `@pi-unipi/notify` | 2.20.5 | 系统权限/远端平台；补丁单独评估 |
| 任务进度 | `@juicesharp/rpiv-todo` | 2.13.9 | 可见 todo |
| 权限（资源禁用） | `@gotgenes/pi-permission-system` | 40.3.0 | extensions/skills/prompts/themes 均 `[]` |
| 输出优化 | `pi-rtk-optimizer` | 0.9.0 | 额外 RTK CLI 与本地配置 |
| 界面/辅助工具 | `pi-cc-extensions` | 1.0.7 | 与其他界面插件组合需运行验证 |
| 文件规划 | `planning-with-files` | 3.24.0 | 计划文件及扩展；不要迁移作者历史任务状态 |
| 会话恢复 | `pi-wtf` | 0.3.0 | 不代表应复制原会话 |
| 缓存优化 | `pi-cache-optimizer` | 2.9.3 | 提供方行为需单独验证 |
| 旁路讨论 | `pi-btw` | 0.8.0 | 额外对话可能产生模型费用 |
| 扩展配置 | `@juanibiapina/pi-extension-settings` | 0.10.0 | 配置管理界面 |
| 资源开关 | `@petechu/pi-extension-toggle` | 0.2.0 | 不复制本机未跟踪开关状态 |
| Fast 底层依赖 | `pi-openai-fast-mode` | 0.5.0 | `extensions: []`，由本地 Ultrafast 包装器引用 |
| Figma 认证 | `pi-figma-remote-auth` | 0.1.3 | **声明固定 `@0.1.3`**；接收方自行授权 |
| 图像输入 | `pi-image-paste` | 1.0.0 | 本机剪贴板/路径能力待验证 |
| PDF | `@joemccann/pi-pdf` | 1.0.1 | **声明固定 `@1.0.1`**；Python 依赖另装 |
| 子 Agent | `@tintinweb/pi-subagents` | 0.22.0 | **声明固定 `@0.22.0`**；角色、模型、编排规则另选 |

`npm/` 被忽略；克隆不包含这些包。局部 `package-lock.json`、FOFA 的 `uv.lock` 只约束对应子项目，不锁定整个个人环境。官方安装器的 Pi 本体依赖锁定也不等于扩展包已锁定。

## 2. 本地扩展与配置

| 仓库资源 | 依赖/迁移点 |
|---|---|
| `extensions/model-skill-gate/` | 源码与 package/lock 已跟踪；本地包依赖不会自动恢复。开发依赖仍声明 Pi `^0.84.4`，不能据此声称对 1.3.0 的开发测试已通过 |
| model-skill-gate 外部资源 | 默认配置 `~/.pi/model-skill-gate.json`，技能克隆 `~/.pi/gated-skills/superpowers` 均不在此仓库；按[扩展说明](../extensions/model-skill-gate/README.md)核对，不自动把 gated 技能暴露给所有模型 |
| `extensions/pi-ultrafast/` | 直接导入 `../../npm/node_modules/pi-openai-fast-mode/src/index.ts`；布局和包版本耦合。测试还写死作者 Pi 1.3.0 安装路径，迁移前另行适配 |
| Ultrafast 行为 | 只针对其代码支持的模型请求 `service_tier: "ultrafast"`；可能增加费用，指示器不是服务端确认。见[说明](../extensions/pi-ultrafast/README.md) |
| `extensions/pi-openai-fast-mode/config.json` | 现有 Fast 偏好，不当作新用户默认选择 |
| `extensions/pi-permission-system/config.json` | 包资源当前禁用；配置存在不证明规则生效，含个人路径 |
| `extensions/pi-rtk-optimizer/config.json` | 与 RTK CLI 对应，是否启用按接收方决定 |
| `extensions/pi-guided-plan/` | 当前不在跟踪清单，目录在核对时不存在；settings 仍排除其入口，不能自动补装 |
| `agents/`、`subagents.json` | 角色约束及并发/调度偏好；implementation/reviewer 当前无静态 model pin，实际模型由调用时选择 |

顶层排除项还包括 `-builtin:mcp`、`-skills/plan-loop/SKILL.md`。安装依赖不构成启用这些资源的理由。

## 3. MCP 与服务依赖

只列无敏感启动信息，不提供作者端点或认证值。配置来源：`mcp.json`。

| 服务器 | 启动链 | 接收方必须决定 |
|---|---|---|
| `playwright` | `npx -y @playwright/mcp@latest` | 浏览器 CDP 端点、输出目录；当前使用 `--caps=vision,pdf`。`latest` 未锁版，npx 可能联网下载 |
| `js-reverse` | `npx -y js-reverse-mcp@4.0.5` | `--browserUrl` 与 `--allowedRoots`，不要照搬作者研究目录；包版本固定不等于浏览器环境固定 |
| `fofa` | `uv run --directory <本机技能目录>/mcp/fofa_MCP python fofa.py` | uv、Python、依赖及本人账户配置；不复制作者账户文档中的资料 |

FOFA 子项目声明 Python `>=3.10`，依赖 `httpx>=0.24.0`、`python-dotenv>=0.19.0`、`mcp>=1.9.0,<2`，并提供 `uv.lock` 与 `.python-version`。实际 Python 选择以子项目文件和接收方环境为准；`uv run` 可能创建环境/安装依赖，不是纯读取检查。

Tavily、Figma、模型提供方及通知远端平台另需接收方认证。`models.json`、`auth.json`、OAuth 目录被忽略，不承诺作者自定义提供方在其他机器存在。

## 4. 技能与 CLI

| 资源/功能 | 仓库边界与外部需求 |
|---|---|
| `skills/archify`、`grill-me`、`grill-with-docs`、`grilling` | 四个 Git 跟踪的符号链接，分别指向 `../../../.agents/skills/<同名目录>`；不是目标内容的备份 |
| `~/.agents/skills/` | Pi 还会直接发现这里的技能，例如作者环境中的 Vue/UI/PPTX 等；不在本仓库清单内，不保证接收方存在 |
| `skills/discuz-plugin-development/`、`figma/`、`figma-design-to-code/` | 跟踪了技能说明/支持文件；目标项目或 Figma 服务不随附 |
| `skills/git-auto-commit/`、`subagent-orchestration/`、`plan-loop/` | 行为/编排规则按需采用；plan-loop 当前被排除，内部历史实施计划不执行 |
| `skills/playwright/`、`playwright-interactive/` | 浏览器、对应运行工具需独立配置；CLI wrapper 使用 npx，Camoufox 脚本 manifest 依赖 `camoufox-js ^0.12.0`、`playwright-core ^1.60.0`；有 lock，不含 node_modules/浏览器下载 |
| `skills/src-hunting/` | 技能、知识库与 FOFA 子项目在仓库中；其浏览器/研究目录等个性化规则需适配，来源记录不当安装命令 |
| `skills/codex-ppt/` | `requirements.txt` 声明 `python-pptx>=1.0.2`、`Pillow>=10.0.0`、`openai>=2.0.0`、`filelock>=3.16.0`；模型/图像服务另行授权，按所选后端核对 CLI |
| 包内技能 | notify、planning-with-files、pi-btw、pi-pdf 等随对应 npm 包提供；只复制 `skills/` 不会带上它们 |
| PDF | 包 README 要求 Python `>=3.9`、`pypdf`、`pdfplumber`、`reportlab`；转换/OCR 按需选 `pdf2image`、`pytesseract`、`pypdfium2`、Pillow 及相应系统工具，不能把 OCR 当已安装 |
| PDF 局限 | 本仓库 AGENTS 记录 pi-pdf 1.0.1 的页码/DPI 参数限制；按指定页渲染可使用 Poppler 的 `pdftoppm`，不是插件自动路由 |
| RTK | `pi-rtk-optimizer` 不替代 RTK 可执行文件；按平台检查版本/路径 |
| 通知 | 当前 notify 依赖 `node-notifier ^10.0.1` 与 `@pi-unipi/core 2.20.5`；macOS 权限和实际通知路径仍需测试 |

本机只做了 PATH 存在性核对：node/npm/npx、python3、uv、git、rtk、pdftoppm、ffmpeg、codex 可找到；terminal-notifier、magick、playwright-cli 未在 PATH 找到。**不是版本/功能验收或必装清单**；例如通知包可能有自己的二进制，npx 也可运行未全局安装的 CLI。

## 5. 个人耦合清单

迁移时逐项预览，不做全仓库字符串替换：

- `settings.json`：主模型快照为 `openai-codex/gpt-6-astra`；observational-memory 独立使用 `xiaolubao/deepseek-v4.1-flash`。这些只是作者选择，不保证接收方拥有对应服务/模型。
- `pi-switch.json`：pins/recent/providerOverrides 是个人模型偏好；不当作提供方认证。子 Agent 另核对 `agents/` 与编排技能，不从主模型推断。
- `mcp.json`：作者 home 下的浏览器输出、研究根目录和 FOFA 路径需要替换；端点及目录权限由接收方确认。
- `scripts/count-prompt-tokens.cjs`：绝对路径引用作者 npm 目录中的 `js-tiktoken`；不能依赖未声明的传递包一定存在。
- `scripts/verify-notify-config.mjs`：绝对路径导入 `jiti` 与 notify 的 `settings.ts`，还依赖 `/tmp/stub-pi-tui.mjs`；检查中写有历史 recap 模型 `deepseek/deepseek-flash`，不代表当前有效配置。通知摘要模型也是独立入口，需接收方另选。此脚本不是通用、无副作用的配置检查入口，迁移时不要直接执行。
- `scripts/measure-prompt-compliance.py`：用于个人提示遵循分析，不是环境安装步骤，不拿作者会话作测试数据。
- `extensions/pi-ultrafast/test.mjs`、权限插件配置、SRC 的来源记录与浏览器/研究者规则还含个人绝对路径；历史来源无需为了迁移篡改，活跃路径按所选功能适配。
- `AGENTS.md`、`APPEND_SYSTEM.md` 中的工具/路径/模型/通知约定是个人偏好；保留接收方规则，明确冲突后才合并。
- `trust.json`、全局 approvals、MCP 授权、会话、缓存、未跟踪 runtime 文件均不迁移。忽略文件与未跟踪文件不是可分享清单。

## 6. 验证边界与依据

已核对：24 个包声明与本机版本、资源过滤语义、已跟踪路径、符号链接、关键 manifest、MCP 启动依赖、个人路径及补丁文本。通知当前源码未见历史 `timeout: false` 补丁标记；**这不能证明它仍需要补丁**。

未执行：新机器安装、包重装、本地扩展测试、Pi 启动/界面验证、模型请求、MCP 连接、通知测试、跨平台测试。缺失服务授权、外部技能和版本兼容性由接收方在迁移时逐组验证。

依据：根 `settings.json` / `mcp.json`、各子项目 manifest、作者安装目录内各 npm 包 `package.json` 与 pi-pdf README、Pi 1.3.0 的 README 和 `docs/{cli,packages,configuration,skills}.md`、本地扩展 README/源码，以及 [通知补丁](../patches/README.md)。外部依赖版本漂移后应重新核对，不能把这份快照当升级许可。
