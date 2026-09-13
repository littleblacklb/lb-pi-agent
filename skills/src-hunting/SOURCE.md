# SOURCE — src-hunting 技能的来源与改动记录

- **来源包**：`/Users/lb/Downloads/clown-src-6k-skill`（Grok CLI 技能包，只读，未改动）
- **安装位置**：`~/.pi/agent/skills/src-hunting/`（pi 全局技能位）
- **安装时间**：2026-09-14
- **安装方式**：pi agent 会话内的移植（Grok → pi），非官方分发
- **PLAN_ID**：`2026-09-14-install-src-hunting-skill-pack-into-pi`（计划与日志在 `~/.pi/agent/.planning/` 同名目录）

## 计数

| 部分 | 数量 | 说明 |
|------|------|------|
| `SKILL.md` | 1 | frontmatter `name` 由 `skill` 改为 `src-hunting` |
| `rules/` | 11 | 包 `rules/` 整份，按需加载 |
| `知识库/` | 49 | 包 `skills/skill/知识库/` 整份 |
| `mcp/fofa_MCP/` | 8 | 见下「未搬」 |
| `bin/` | 1 | `chrome-9222.sh`，本机新增（源包 `bin/` 里是 Windows 专用的 dual-slot 脚本，未搬） |
| 合计（不含 `.venv`） | 70 | 与源包逐文件 sha256 比对见下 |

## 与源包的差异（70 文件）

- **逐字节一致：50 个**（含 `rules/` 5 个、`知识库/` 41 个、`mcp/fofa_MCP/` 的 `README.md`/`pyproject.toml`/`uv.lock`/`.python-version`）
- **有改写：19 个**：
  - `SKILL.md`（name、3 处 `~/.grok` 路径、加 1 行 rules 映射）
  - `rules/`：`desktop-task-folder.md`、`dig-scope-workflow.md`、`hunt-iter.md`、`playwright-browser-mcp.md`、`researcher-blackbox-whitebox.md`、`vuln-report-format.md`
  - `知识库/`：`README.md`、`recon-methodology.md`、`graphql-test.md`、`info-leak-test.md`、`idor-test.md`、`logic-test.md`、`file-upload-test.md`、`cache-poisoning-test.md`（均为 `~/.grok/...` → `../rules/...` / `../mcp/fofa_MCP/.env`）
  - `mcp/fofa_MCP/`：`fofa.py`（1 处注释 + 1 处报错文案）、`fofa_accounts.md`（配置位置）、`.env.example`（改为空值模板）、`.gitignore`（加 `.env` 忽略）
- **新增：1 个**：`.gitignore`（`.venv/`、`__pycache__/`、`*.pyc`）
- 全量 sha256 清单：`SOURCE.sha256.txt`

## 未搬（故意）

| 源包内容 | 原因 |
|---|---|
| `mcp-servers/fofa_MCP/.env` | 含发送方凭证；由 `.env.example` 生成空模板代替（见「用户待办」） |
| `bin/playwright-dual-slot.mjs` | Windows 专用；改用 `@playwright/mcp --cdp-endpoint` attach 共用 Chrome |
| `mcp-servers/fofa_MCP/fofa_dual.ps1` | Windows PowerShell 专用 |
| `config.toml`、`AGENTS.md`、`给朋友的提示词.txt` | Grok CLI / Windows 专用 |
| `docs/`（27 篇） | 面向 Grok 用户的文档，非运行所需 |

## 修改原则（本次移植）

1. 只改**必然跑不通**的东西：`~/.grok` 路径、Windows 专用命令、Grok 专有 MCP 工具名、桌面任务根约定。
2. 现场证据优先：`127.0.0.1:7897` 代理段与本机 Clash 端口一致 → **保留原文**。
3. 明知在 pi 上跑不通但按用户决定**保留原文**的部分（未改）：
   - 子线程 / 主控 / spawn 条文（pi 当前无 Agent/Task 工具；`hunt-iter` 16 处、`dig-scope-workflow` 6 处）
   - bash `grep`/`find` 配方（本机权限策略硬拒；12 文件约 50 处）
4. 报告换行按用户决定由 CRLF 改为 **LF**。

## 用户待办

1. **创建 FOFA 凭证文件**（pi 的权限策略拦住了 agent 写 `.env` 的任何操作，需你手动一条命令）：
   ```bash
   cd ~/.pi/agent/skills/src-hunting/mcp/fofa_MCP && cp .env.example .env && chmod 600 .env
   ```
   然后把三套 Key 填进 `.env`（该文件已被同目录 `.gitignore` 忽略，不进 git）。
2. 重启 pi 后首次调用三个 MCP（`playwright` / `js-reverse` / `fofa`）会弹授权。
3. 用浏览器前先 `bash ~/.pi/agent/skills/src-hunting/bin/chrome-9222.sh`（两个浏览器 MCP 都 attach 它的 9222）。

## 复核对账命令

```bash
cd ~/.pi/agent/skills/src-hunting
rg -uu --glob '!**/.venv/**' -n '\.grok|Desktop|Remove-Item|search_tool|use_tool' .   # 期望 0 行
ls rules | wc -l        # 11
ls 知识库 | wc -l       # 49
python3 - <<'EOF'       # 逐文件校验 SOURCE.sha256.txt
import hashlib
for line in open('SOURCE.sha256.txt'):
    if line.startswith('#'): continue
    h, p = line.split(None, 1); p = p.strip()
    assert hashlib.sha256(open(p,'rb').read()).hexdigest() == h, p
print('manifest OK')
EOF
```
