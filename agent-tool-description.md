Launch a worker for one approved responsibility.
{{typeList}}

Before dispatch/resume, read {{agentDir}}/skills/subagent-orchestration/SKILL.md.
Require execution/delegation authorization; reviewer needs explicit review approval. No automatic Astra.
NEW calls: explicit exact available provider/model ID; respect user choice and check role pins first. Resume retains its model.
At most TWO live workers TOTAL across all entrypoints (not enforced by separate pools). No recursive delegation or overlapping writers.
Use a bounded handoff and fresh context; preserve permission extensions. Same-task rework resumes the settled original worker. Follow the skill for model defaults, stop/fallback, reports and verification.
Roles: .pi/agents/ (project override) or {{agentDir}}/agents/ (global).
