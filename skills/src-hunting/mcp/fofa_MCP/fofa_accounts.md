# FOFA 三账号（挖洞用）

策略：**优先主号** → 遇 429 / 请求频繁 / 820041 / 日上限 → **自动切备用1** → 再用 **备用2**。

| 角色 | Email | 备注 |
|------|-------|------|
| 主号 primary | （自己填） | FOFA_EMAIL / FOFA_KEY |
| 备用 backup | （可空，只传 key） | FOFA_KEY_BACKUP |
| 备用2 backup2 | （自己填） | 前两个用尽才用 |

Key 只写在本目录 `.env`，不要抄进对话 / skill / 知识库 / 报告，也不要写进 `~/.pi/agent/mcp.json`。

## 配置位置

- `~/.pi/agent/skills/src-hunting/mcp/fofa_MCP/.env`（唯一权威位置，`chmod 600`，已在同目录 .gitignore 里）
- `~/.pi/agent/mcp.json` 的 `fofa` 条目**不写** `env` 键：空值会盖掉 `.env`（`load_dotenv()` 默认不覆盖已有环境变量）
- 逻辑：`fofa.py` 内 `_account_list` + `_exhausted` + `_is_rate_limited`

## curl 备用（MCP 未热加载时）

主号 / 备用1 / 备用2 分别用对应 email+key 调 `https://fofa.info/api/v1/search/all`。限流换下一个，不要空撞。

## 注意

- MCP 改 env 后需**重启 fofa MCP / 会话**才进进程；未重启时 Agent 可用 curl 手切。
- 三个都限流 → 停 FOFA，挖已入库。
- 换机后：重新 `uv sync`，把三套 Key 填进本目录 `.env`。
