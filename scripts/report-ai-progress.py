#!/usr/bin/env python3

import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from pathlib import Path

TAIPEI = timezone(timedelta(hours=8))


@dataclass
class Paths:
    root: Path
    current_work: Path
    ai_activity: Path
    ai_activity_log: Path


def resolve_paths() -> Paths:
    root = Path(__file__).resolve().parents[1]
    current_work = Path(os.environ.get("CURRENT_WORK_FILE", root / "docs/status/current-work.md"))
    ai_activity = Path(os.environ.get("AI_ACTIVITY_FILE", root / "docs/status/ai-activity.json"))
    ai_activity_log = Path(os.environ.get("AI_ACTIVITY_LOG_FILE", root / "docs/status/ai-activity-log.json"))
    return Paths(root=root, current_work=current_work, ai_activity=ai_activity, ai_activity_log=ai_activity_log)


def now_parts():
    now = datetime.now(TAIPEI)
    return {
        "iso": now.strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "long": now.strftime("%Y-%m-%d %H:%M"),
        "short": now.strftime("%H:%M"),
    }


def ensure_activity_file(path: Path):
    if path.exists():
        return

    payload = {
        "lastUpdated": "",
        "current": "Codex",
        "members": [
            {
                "name": "Codex",
                "role": "技術主導 / 最終裁決",
                "avatar": "🧠",
                "status": "idle",
                "currentTask": "等待分配新任務",
                "tasksCompleted": 0,
                "lastActive": "",
            },
            {
                "name": "Qwen",
                "role": "低風險實作 / 文件整理",
                "avatar": "✍️",
                "status": "idle",
                "currentTask": "等待分配新任務",
                "tasksCompleted": 0,
                "lastActive": "",
            },
            {
                "name": "Gemini",
                "role": "公開資料蒐集",
                "avatar": "🔍",
                "status": "idle",
                "currentTask": "等待分配新任務",
                "tasksCompleted": 0,
                "lastActive": "",
            },
            {
                "name": "Claude",
                "role": "strategy brain second opinion",
                "avatar": "🎯",
                "status": "idle",
                "currentTask": "等待分配新任務",
                "tasksCompleted": 0,
                "lastActive": "",
            },
        ],
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def ensure_activity_log_file(path: Path):
    if path.exists():
        return

    payload = {
        "lastUpdated": "",
        "entries": [],
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def load_activity(path: Path):
    ensure_activity_file(path)
    return json.loads(path.read_text(encoding="utf-8"))


def load_activity_log(path: Path):
    ensure_activity_log_file(path)
    return json.loads(path.read_text(encoding="utf-8"))


def save_activity(path: Path, payload):
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def save_activity_log(path: Path, payload):
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def get_member(payload, ai_name: str):
    members = payload.setdefault("members", [])
    for member in members:
        if member.get("name") == ai_name:
            return member

    member = {
        "name": ai_name,
        "role": "外部協作 AI",
        "avatar": "🤖",
        "status": "idle",
        "currentTask": "等待分配新任務",
        "tasksCompleted": 0,
        "lastActive": "",
    }
    members.append(member)
    return member


def rewrite_last_updated(markdown: str, new_value: str) -> str:
    lines = markdown.splitlines()
    for index, line in enumerate(lines):
        if line.startswith("Last updated:"):
            lines[index] = f"Last updated: {new_value}"
            return "\n".join(lines) + "\n"
    return markdown


def insert_checkpoint(markdown: str, checkpoint_line: str) -> str:
    marker = "## Latest checkpoint"
    marker_index = markdown.find(marker)
    if marker_index == -1:
        raise RuntimeError("找不到 '## Latest checkpoint' 區塊")

    insert_pos = marker_index + len(marker)
    remainder = markdown[insert_pos:]
    if remainder.startswith("\n\n"):
        return markdown[: insert_pos + 2] + checkpoint_line + "\n" + remainder[2:]
    if remainder.startswith("\n"):
        return markdown[: insert_pos + 1] + "\n" + checkpoint_line + remainder[1:]
    return markdown[:insert_pos] + "\n\n" + checkpoint_line + "\n\n" + remainder


def update_current_work(path: Path, ai_name: str, message: str):
    parts = now_parts()
    markdown = path.read_text(encoding="utf-8")
    markdown = rewrite_last_updated(markdown, parts["long"])
    checkpoint_line = f"- `{parts['long']}` {ai_name}：{message}"
    markdown = insert_checkpoint(markdown, checkpoint_line)
    path.write_text(markdown, encoding="utf-8")


def append_activity_log(path: Path, payload, *, ai_name: str, action: str, message: str, parts):
    log_payload = load_activity_log(path)
    entries = log_payload.setdefault("entries", [])
    member = get_member(payload, ai_name)
    entries.insert(0, {
        "time": parts["long"],
        "isoTime": parts["iso"],
        "ai": ai_name,
        "action": action,
        "message": message,
        "status": member.get("status", "idle"),
    })
    del entries[40:]
    log_payload["lastUpdated"] = parts["iso"]
    save_activity_log(path, log_payload)


def main():
    if len(sys.argv) < 3:
        print("用法：report-ai-progress.py <start|progress|done|handover|suggest|blocker|idle> <ai_name> [message...]", file=sys.stderr)
        raise SystemExit(1)

    action = sys.argv[1]
    ai_name = sys.argv[2]
    message = " ".join(sys.argv[3:]).strip()
    if action not in {"status"} and not message:
        print("錯誤：請提供訊息", file=sys.stderr)
        raise SystemExit(1)

    paths = resolve_paths()
    activity = load_activity(paths.ai_activity)
    parts = now_parts()
    member = get_member(activity, ai_name)

    if action == "start":
        member["status"] = "working"
        member["statusSource"] = "manual"
        member["currentTask"] = message
        member["lastActive"] = parts["long"]
        activity["current"] = ai_name
    elif action == "progress":
        member["status"] = "working"
        member["statusSource"] = "manual"
        member["currentTask"] = message
        member["lastActive"] = parts["long"]
        activity["current"] = ai_name
    elif action == "done":
        update_current_work(paths.current_work, ai_name, message)
        member["status"] = "idle"
        member["statusSource"] = "manual"
        member["currentTask"] = "等待分配新任務"
        member["tasksCompleted"] = int(member.get("tasksCompleted", 0)) + 1
        member["lastActive"] = parts["long"]
        activity["current"] = ai_name
    elif action == "handover":
        update_current_work(paths.current_work, ai_name, f"交接：{message}")
        member["status"] = "idle"
        member["statusSource"] = "manual"
        member["currentTask"] = "等待分配新任務"
        member["lastActive"] = parts["long"]
        activity["current"] = ai_name
    elif action == "suggest":
        update_current_work(paths.current_work, ai_name, f"建議：{message}")
        member["lastActive"] = parts["long"]
        activity["current"] = ai_name
    elif action == "blocker":
        update_current_work(paths.current_work, ai_name, f"阻礙：{message}")
        member["status"] = "idle"
        member["statusSource"] = "manual"
        member["currentTask"] = "等待分配新任務"
        member["lastActive"] = parts["long"]
        activity["current"] = ai_name
    elif action == "idle":
        member["status"] = "idle"
        member["statusSource"] = "manual"
        member["currentTask"] = message
        member["lastActive"] = parts["long"]
    else:
        print(f"未知 action: {action}", file=sys.stderr)
        raise SystemExit(1)

    activity["lastUpdated"] = parts["iso"]
    save_activity(paths.ai_activity, activity)
    append_activity_log(paths.ai_activity_log, activity, ai_name=ai_name, action=action, message=message, parts=parts)
    print(f"✅ 已更新 AI 進度：{ai_name} / {action}")


if __name__ == "__main__":
    main()
