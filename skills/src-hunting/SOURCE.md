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

## 本机权限调整（2026-09-14，用户要求）

在 `~/.pi/agent/extensions/pi-permission-system/config.json` 的 `permission.bash` 末尾追加（该扩展用 `findLast` 语义，后写覆盖先写，所以位于 `bash *`=ask 之后生效）：

| 规则 | 判定 |
|---|---|
| `bash / sh / zsh <skill>/bin/*`、直接执行 `<skill>/bin/*` | **allow** |
| `bash / sh / zsh /Users/lb/src-hunt/*`、直接执行同路径 | **allow** |
| `uv run --directory <skill>/*` | **allow** |
| 其余 `bash …`（含 `bash -c`）、`sh …` | 仍 **ask** |
| `rm *` / `mv *` / `sudo *` / `git reset --hard` 等 | 仍按原策略（ask） |

备份：`extensions/pi-permission-system/config.json.bak-20260914-before-srchunt`。实测：`bash <skill>/bin/chrome-9222.sh` 不再弹审批。

## fofa 实测

### 阶段 1：官方接口（主号）

- 返回 `{"error":"限流/配额: [820031] F点余额不足","account":"primary","http_status":200,"account_tried":["primary"]}`
- 判读：认证与链路正常（HTTP 200 + FOFA 业务码）、Key 有效；主号 F 点为 0，故无结果；backup/backup2 未配置（`_account_list()` 用 `if a[2]` 过滤空 Key），所以无处切号。

### 阶段 2：第三方代理接口（已跑通）

- `.env`：`FOFA_API_BASE=http://map.shenxd.top/fofa/test_fofa/fofa1_api.php`，主号换成第三方给的 email/key
- 生效确认（让程序自己解析、不读文件、不打印凭据）：`fofa.FOFA_API_BASE` = 上述 URL；生效账号 1 个（primary）
- 实测 1 `domain="example.com"` → `count=5`、`query_consumed=0`、`account_used=primary`，真实资产（172.66.147.243 / 104.20.23.154 等）
- 实测 2 `domain="qq.com"` → 总匹配 `size=8088`，本次 `count=100`（fofa.py 请求的 `size=100` 生效）
- 字段语义：第三方把 `size` 当「匹配总数」、`count` 当「本次返回条数」
- 探测（无凭据阶段）：`fofa1_api.php` 存活、参数名 `qbase64` 与官方一致；假凭据返回 `API密钥无效或已过期` → 真实 FOFA 后端；`fofa2_api.php` 404
- 切回官方：清空 `FOFA_API_BASE` + 换回官方 email/key（base 全局，两者不能混用）

## 用户待办

> 状态：`.env` 已由用户配置（`chmod 600` ✅、被 `.gitignore` 忽略 ✅）；**fofa 已跑通（当前走第三方代理接口）**。

1. **创建 FOFA 凭证文件** — 已完成（命令备查：`cd ~/.pi/agent/skills/src-hunting/mcp/fofa_MCP && cp .env.example .env && chmod 600 .env`）
2. 重启 pi 后首次调用三个 MCP（`playwright` / `js-reverse` / `fofa`）会弹授权。
3. （可选）决定 9222 上那只调试 Chrome 是否常驻后台：`curl -s http://127.0.0.1:9222/json/version`。

## Agent 自行动作（不需要用户介入）

- **首次浏览器操作前自己跑 `bin/chrome-9222.sh`**：它只确保 9222 上有一只可用调试 Chrome（两个浏览器 MCP 都 attach 它），幂等——9222 已在响应就立刻退出，**不杀浏览器、不清 profile**。实测直接执行脚本路径即可（命中 `permission.*: allow`，不弹审批）；写成 `bash <path>` 会命中 `bash *` = ask 而多弹一次审批。
- 快照/输出默认落在 MCP 的 `--output-dir`；需要当证据留档时自己拷进任务目录的 `{名}_dig/`。

## 运行期实测（2026-09-14 本机，非静态推断）

| 检查 | 结果 |
|---|---|
| MCP 网关注册 | `mcp({})` → 3/3 server 已注册（lazy connect，初始均 disconnected） |
| playwright | 连接成功，**31 工具**；`playwright_browser_navigate https://example.com` → 200，snapshot 正常 |
| js-reverse | 连接成功，**24 工具**；attach 同一只 9222 Chrome：`select_page` 能看到 playwright 打开的页面，`list_network_requests` 抓到 `GET https://example.com/?pi_mcp_test=1 → 200`，`list_scripts` 见 22 个脚本，`evaluate_script`（需 `confirm=true`）正常返回 |
| fofa | 连接成功，1 工具 `fofa_get_alerts`；无 Key 时返回指向新 `.env` 路径的中文报错 |
| `bin/chrome-9222.sh` | 实跑成功：Chrome 153 起在 9222，profile 建于 `~/Library/Caches/pi-playwright/profile`（幂等复查会直接复用） |
| 文档工具名一致性 | skill 内引用的 10 个工具名与实测**完全一致**；`fofa__get_alerts`（双下划线）已改正为 `fofa_get_alerts` |
| 待重启生效 | `mcp.json` 新增的 `--output-dir` 未在运行中的 server 进程生效（`ps` 核对 args 无此项）→ 重启 pi 后输出移出仓库；当前已用 `.gitignore` 兜底 `<cwd>/.playwright-mcp/` 与 `mcp-npx-cache.json` |

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
