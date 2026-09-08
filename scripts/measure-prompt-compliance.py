#!/usr/bin/env python3
"""Measure global-instruction compliance from pi session logs.

Splits every session at RULES_CREATED (when ~/.pi/agent/AGENTS.md and
APPEND_SYSTEM.md were written) and reports per-100-assistant-turn rates for the
behaviours those files regulate, plus the "waiting turn without notify" rate.

Usage:
    measure-prompt-compliance.py [--sessions DIR] [--split ISO8601] [--per-session]

Baseline recorded 2026-09-09 in ~/.pi/agent/plans/2026-09-09-agents-md-fix.md.
"""

import argparse
import glob
import json
import os
import re
import sys
from datetime import datetime, timezone

SESSIONS_DEFAULT = os.path.expanduser("~/.pi/agent/sessions")
# ~/.pi/agent/AGENTS.md mtime 2026-09-03 19:12:58 CST, APPEND_SYSTEM.md 19:13:04 CST
RULES_CREATED_DEFAULT = "2026-09-03T11:13:00Z"

BASH_SEARCH_RE = re.compile(r"^\s*(grep|rg|find|fd|ag|ack)\b")
PIPE_SEARCH_RE = re.compile(r"\|\s*(grep|rg|find|fd|ag|ack)\b")
FFF_TOOLS = {"ffgrep", "fffind", "fff-multi-grep", "fff_multi_grep"}
SEARCH_TOOLS = {"grep", "find"}


def session_start(path):
    m = re.match(r"(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})(?:-\d+)?Z", os.path.basename(path))
    if not m:
        return None
    return datetime.strptime(m.group(1), "%Y-%m-%dT%H-%M-%S").replace(tzinfo=timezone.utc)


def parse_turns(path):
    """Return the message sequence: {'role': 'user'} or {'role','text','tools','bash'}."""
    turns = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if entry.get("type") != "message":
                continue
            message = entry.get("message") or {}
            role = message.get("role")
            if role == "user":
                turns.append({"role": "user"})
            elif role == "assistant":
                text, tools, bash = [], [], []
                content = message.get("content")
                if isinstance(content, str):
                    text.append(content)
                elif isinstance(content, list):
                    for block in content:
                        if not isinstance(block, dict):
                            continue
                        kind = block.get("type")
                        if kind == "text":
                            text.append(block.get("text") or "")
                        elif kind == "toolCall":
                            name = block.get("name") or ""
                            tools.append(name)
                            args = block.get("arguments")
                            if name == "bash" and isinstance(args, dict):
                                bash.append(args.get("command") or "")
                turns.append(
                    {
                        "role": "assistant",
                        "text": "\n".join(text).strip(),
                        "tools": tools,
                        "bash": bash,
                    }
                )
    return turns


def analyze(path):
    """Return per-session counters."""
    stats = {
        "assistant_turns": 0,
        "runs": 0,
        "text_runs": 0,
        "waiting_runs": 0,
        "waiting_without_notify": 0,
        "notify": 0,
        "ask_user": 0,
        "todo": 0,
        "fff": 0,
        "bash_direct": 0,
        "bash_piped": 0,
        "search_tool": 0,
    }
    turns = parse_turns(path)
    run = []

    def close_run():
        if not run:
            return
        stats["runs"] += 1
        last = run[-1]
        if last["text"]:
            stats["text_runs"] += 1
        waiting = "ask_user_question" in last["tools"] or last["text"].endswith(("?", "？"))
        if waiting:
            stats["waiting_runs"] += 1
            if not any("notify_user" in t["tools"] for t in run):
                stats["waiting_without_notify"] += 1

    for turn in turns:
        if turn["role"] == "user":
            close_run()
            run = []
            continue
        stats["assistant_turns"] += 1
        run.append(turn)
        for name in turn["tools"]:
            if name == "notify_user":
                stats["notify"] += 1
            elif name == "ask_user_question":
                stats["ask_user"] += 1
            elif name == "todo":
                stats["todo"] += 1
            elif name in FFF_TOOLS:
                stats["fff"] += 1
            elif name in SEARCH_TOOLS:
                stats["search_tool"] += 1
        for cmd in turn["bash"]:
            if BASH_SEARCH_RE.match(cmd):
                stats["bash_direct"] += 1
            elif PIPE_SEARCH_RE.search(cmd):
                stats["bash_piped"] += 1
    close_run()
    return stats


COUNTERS = (
    "assistant_turns",
    "runs",
    "text_runs",
    "waiting_runs",
    "waiting_without_notify",
    "notify",
    "ask_user",
    "todo",
    "fff",
    "bash_direct",
    "bash_piped",
    "search_tool",
)


def empty_totals():
    return {key: 0 for key in COUNTERS}


def add(totals, stats):
    for key, value in stats.items():
        totals[key] = totals.get(key, 0) + value


def per100(totals, key):
    turns = totals["assistant_turns"]
    return (100.0 * totals[key] / turns) if turns else 0.0


def report(label, totals, sessions):
    print(
        f"{label:<34} sessions={sessions:>3} turns={totals['assistant_turns']:>5}  "
        f"fff={per100(totals, 'fff'):5.1f}  bash_search_direct={per100(totals, 'bash_direct'):5.1f}  "
        f"bash_search_piped={per100(totals, 'bash_piped'):5.1f}  grep/find_tool={per100(totals, 'search_tool'):4.1f}"
    )
    print(
        f"{'':<34} todo={per100(totals, 'todo'):5.1f}  notify={per100(totals, 'notify'):5.1f}  "
        f"ask_user={per100(totals, 'ask_user'):5.1f}  |  text_runs={totals['text_runs']}  "
        f"waiting={totals['waiting_runs']}  waiting_without_notify={totals['waiting_without_notify']} "
        f"({100.0 * totals['waiting_without_notify'] / totals['waiting_runs'] if totals['waiting_runs'] else 0:.0f}%)"
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sessions", default=SESSIONS_DEFAULT)
    ap.add_argument("--split", default=RULES_CREATED_DEFAULT, help="ISO8601 UTC boundary")
    ap.add_argument("--per-session", action="store_true")
    args = ap.parse_args()

    split = datetime.fromisoformat(args.split.replace("Z", "+00:00"))
    before, after = empty_totals(), empty_totals()
    n_before = n_after = 0
    rows = []
    for path in sorted(glob.glob(os.path.join(args.sessions, "**", "*.jsonl"), recursive=True)):
        started = session_start(path)
        if started is None:
            continue
        stats = analyze(path)
        if stats["assistant_turns"] == 0:
            continue
        window = "after" if started >= split else "before"
        if window == "after":
            add(after, stats)
            n_after += 1
        else:
            add(before, stats)
            n_before += 1
        rows.append((started, window, stats, path))

    if args.per_session:
        for started, window, stats, path in sorted(rows):
            print(
                f"{started.isoformat()} {window:<6} turns={stats['assistant_turns']:>4} "
                f"fff={stats['fff']:>3} bash={stats['bash_direct']:>3} todo={stats['todo']:>3} "
                f"notify={stats['notify']:>2} ask={stats['ask_user']:>2} "
                f"waiting={stats['waiting_runs']:>2} w/o_notify={stats['waiting_without_notify']:>2} "
                f"{os.path.basename(path)[:28]}"
            )
        print()

    report("BEFORE rules (" + split.date().isoformat() + ")", before, n_before)
    report("AFTER  rules", after, n_after)
    return 0


if __name__ == "__main__":
    sys.exit(main())
