#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

TAIPEI = timezone(timedelta(hours=8))


@dataclass
class Detection:
    ai: str
    source: str
    event_time: datetime | None
    task: str


def now_taipei() -> datetime:
    return datetime.now(TAIPEI)


def format_long(dt: datetime) -> str:
    return dt.astimezone(TAIPEI).strftime("%Y-%m-%d %H:%M")


def format_iso(dt: datetime) -> str:
    return dt.astimezone(TAIPEI).strftime("%Y-%m-%dT%H:%M:%S+08:00")


def parse_maybe_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        if value.endswith("Z"):
            return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(TAIPEI)
        return datetime.fromisoformat(value).astimezone(TAIPEI)
    except Exception:
        try:
            return datetime.strptime(value, "%Y-%m-%d %H:%M").replace(tzinfo=TAIPEI)
        except Exception:
            return None


def project_slug(repo_root: Path) -> str:
    parts = [p for p in repo_root.parts if p and p not in {"/", "\\"}]
    return "-" + "-".join(parts)


def load_json(path: Path, fallback: dict[str, Any]) -> dict[str, Any]:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def save_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def ensure_member(activity: dict[str, Any], name: str, role: str, avatar: str) -> dict[str, Any]:
    members = activity.setdefault("members", [])
    for member in members:
        if member.get("name") == name:
            return member

    member = {
        "name": name,
        "role": role,
        "avatar": avatar,
        "status": "idle",
        "currentTask": "等待分配新任務",
        "tasksCompleted": 0,
        "lastActive": "",
    }
    members.append(member)
    return member


def read_recent_jsonl(path: Path, byte_limit: int = 200_000) -> list[dict[str, Any]]:
    if not path.exists() or path.stat().st_size == 0:
        return []
    with path.open("rb") as fp:
        fp.seek(0, 2)
        size = fp.tell()
        fp.seek(max(0, size - byte_limit))
        chunk = fp.read().decode("utf-8", errors="ignore")
    records = []
    for line in chunk.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except Exception:
            continue
        if isinstance(obj, dict):
            records.append(obj)
    return records


def extract_qwen_task(chat_file: Path) -> str:
    records = read_recent_jsonl(chat_file)
    for item in reversed(records):
        if item.get("type") not in {"user", "assistant"}:
            continue
        message = item.get("message") or {}
        parts = message.get("parts") if isinstance(message, dict) else None
        if not isinstance(parts, list):
            continue
        for part in parts:
            text = part.get("text") if isinstance(part, dict) else None
            if isinstance(text, str):
                cleaned = " ".join(text.split()).strip()
                if cleaned:
                    return f"Qwen：{cleaned[:72]}"
    return f"Qwen：偵測到 chat 活動（{chat_file.stem[:8]}）"


def detect_qwen(repo_root: Path) -> Detection:
    qwen_chat_dir = Path.home() / ".qwen" / "projects" / project_slug(repo_root) / "chats"
    files = sorted(qwen_chat_dir.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True) if qwen_chat_dir.exists() else []
    if not files:
        return Detection(ai="Qwen", source="~/.qwen", event_time=None, task="等待分配新任務")
    latest = files[0]
    event_time = datetime.fromtimestamp(latest.stat().st_mtime, tz=TAIPEI)
    return Detection(ai="Qwen", source="~/.qwen/projects/*/chats", event_time=event_time, task=extract_qwen_task(latest))


def detect_codex() -> Detection:
    session_index = Path.home() / ".codex" / "session_index.jsonl"
    if not session_index.exists():
        return Detection(ai="Codex", source="~/.codex", event_time=None, task="等待分配新任務")
    event_time = datetime.fromtimestamp(session_index.stat().st_mtime, tz=TAIPEI)
    records = read_recent_jsonl(session_index, 64_000)
    thread_name = ""
    if records:
        thread_name = str(records[-1].get("thread_name", "")).strip()
    task = f"Codex：{thread_name[:72]}" if thread_name else "Codex：偵測到近期 session 活動"
    return Detection(ai="Codex", source="~/.codex/session_index.jsonl", event_time=event_time, task=task)


def detect_gemini(repo_root: Path) -> Detection:
    usage_log = Path.home() / ".gemini" / "usage-log.tsv"
    if not usage_log.exists():
        return Detection(ai="Gemini", source="~/.gemini", event_time=None, task="等待分配新任務")

    event_time = datetime.fromtimestamp(usage_log.stat().st_mtime, tz=TAIPEI)
    lines = [line.strip() for line in usage_log.read_text(encoding="utf-8", errors="ignore").splitlines() if line.strip()]
    for line in reversed(lines):
        cols = line.split("\t")
        if len(cols) < 5:
            continue
        ts, model, mode, lane, cwd = cols[:5]
        if str(repo_root) not in cwd:
            continue
        ts_dt = parse_maybe_datetime(ts)
        if ts_dt:
            event_time = ts_dt
        task = f"Gemini：{mode}/{lane} ({model})"
        return Detection(ai="Gemini", source="~/.gemini/usage-log.tsv", event_time=event_time, task=task)
    return Detection(ai="Gemini", source="~/.gemini/usage-log.tsv", event_time=event_time, task="Gemini：偵測到近期 CLI 活動")


def detect_claude(repo_root: Path) -> Detection:
    history = Path.home() / ".claude" / "history.jsonl"
    if not history.exists():
        return Detection(ai="Claude", source="~/.claude", event_time=None, task="等待分配新任務")

    event_time = datetime.fromtimestamp(history.stat().st_mtime, tz=TAIPEI)
    records = read_recent_jsonl(history, 256_000)
    repo_text = str(repo_root)
    for item in reversed(records):
        project = str(item.get("project", ""))
        if repo_text not in project:
            continue
        timestamp = item.get("timestamp")
        display = str(item.get("display", "")).strip()
        if isinstance(timestamp, (int, float)):
            event_time = datetime.fromtimestamp(float(timestamp) / 1000.0, tz=timezone.utc).astimezone(TAIPEI)
        if display:
            cleaned = " ".join(display.split())
            return Detection(ai="Claude", source="~/.claude/history.jsonl", event_time=event_time, task=f"Claude：{cleaned[:72]}")
    return Detection(ai="Claude", source="~/.claude/history.jsonl", event_time=event_time, task="Claude：偵測到近期 CLI 活動")


def append_log_entry(log_payload: dict[str, Any], *, ai: str, message: str, status: str, action: str) -> None:
    now = now_taipei()
    entries = log_payload.setdefault("entries", [])
    entry = {
        "time": format_long(now),
        "isoTime": format_iso(now),
        "ai": ai,
        "action": action,
        "message": message,
        "status": status,
    }
    entries.insert(0, entry)
    del entries[80:]
    log_payload["lastUpdated"] = format_iso(now)


def apply_detection(
    activity: dict[str, Any],
    log_payload: dict[str, Any],
    detection: Detection,
    *,
    working_window: timedelta,
    debug: bool = False,
) -> bool:
    role_avatar = {
        "Codex": ("技術主導 / 最終裁決", "🧠"),
        "Qwen": ("低風險實作 / 文件整理", "✍️"),
        "Gemini": ("公開資料蒐集", "🔍"),
        "Claude": ("strategy brain second opinion", "🎯"),
    }
    role, avatar = role_avatar.get(detection.ai, ("外部協作 AI", "🤖"))
    member = ensure_member(activity, detection.ai, role, avatar)

    prev_status = member.get("status", "idle")
    prev_task = member.get("currentTask", "等待分配新任務")
    prev_source = member.get("statusSource", "manual")

    now = now_taipei()
    is_recent = bool(detection.event_time and now - detection.event_time <= working_window)
    changed = False

    if debug:
        delta = (now - detection.event_time).total_seconds() / 60 if detection.event_time else None
        print(f"[debug] {detection.ai}: event={detection.event_time} recent={is_recent} delta_min={delta}")

    if is_recent:
        incoming_time = detection.event_time
        existing_time = parse_maybe_datetime(member.get("lastActive"))
        should_override = (
            prev_source != "manual"
            or prev_status != "working"
            or not existing_time
            or (incoming_time and existing_time and incoming_time > existing_time)
        )
        if debug:
            print(f"[debug] {detection.ai}: prev_status={prev_status} prev_source={prev_source} existing={existing_time} should_override={should_override}")
        if should_override:
            member["status"] = "working"
            member["statusSource"] = "auto"
            member["currentTask"] = detection.task
            member["lastActive"] = format_long(detection.event_time or now)
            member["activitySource"] = detection.source
            changed = (prev_status != member["status"]) or (prev_task != member["currentTask"])
            if changed:
                append_log_entry(
                    log_payload,
                    ai=detection.ai,
                    message=f"{detection.task}（自動偵測）",
                    status="working",
                    action="auto-detect",
                )
    else:
        if prev_source == "auto" and prev_status == "working":
            member["status"] = "idle"
            member["currentTask"] = "等待分配新任務"
            member["statusSource"] = "auto"
            changed = True
            append_log_entry(
                log_payload,
                ai=detection.ai,
                message="超過活動視窗，已自動切回待命",
                status="idle",
                action="auto-detect",
            )

    return changed


def update_current_ai(activity: dict[str, Any]) -> None:
    members = activity.get("members", [])
    working = [m for m in members if m.get("status") == "working"]
    if not working:
        return

    def sort_key(member: dict[str, Any]) -> float:
        ts = parse_maybe_datetime(member.get("lastActive"))
        return ts.timestamp() if ts else 0.0

    working.sort(key=sort_key, reverse=True)
    activity["current"] = working[0].get("name", activity.get("current", "Codex"))


def main() -> int:
    default_window = int(os.environ.get("AI_PRESENCE_WINDOW_MINUTES", "90"))
    parser = argparse.ArgumentParser(description="Auto-refresh AI presence from local agent traces")
    parser.add_argument("--window-minutes", type=int, default=default_window, help="mark agent as working if source activity is within this window")
    parser.add_argument("--quiet", action="store_true", help="suppress output")
    parser.add_argument("--debug", action="store_true", help="print detection decisions")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    activity_path = repo_root / "docs/status/ai-activity.json"
    activity_log_path = repo_root / "docs/status/ai-activity-log.json"

    activity = load_json(
        activity_path,
        {
            "lastUpdated": "",
            "current": "Codex",
            "members": [],
        },
    )
    log_payload = load_json(
        activity_log_path,
        {
            "lastUpdated": "",
            "entries": [],
        },
    )

    working_window = timedelta(minutes=max(1, args.window_minutes))
    detections = [
        detect_codex(),
        detect_qwen(repo_root),
        detect_gemini(repo_root),
        detect_claude(repo_root),
    ]

    changed = False
    for detection in detections:
        changed = apply_detection(
            activity,
            log_payload,
            detection,
            working_window=working_window,
            debug=args.debug,
        ) or changed

    update_current_ai(activity)

    if changed:
        activity["lastUpdated"] = format_iso(now_taipei())
        save_json(activity_path, activity)
        save_json(activity_log_path, log_payload)
        if not args.quiet:
            print("✅ 已自動刷新 AI presence（有變更）")
    else:
        # Keep output calm during daemon runs; only print in non-quiet mode.
        if not args.quiet:
            print("ℹ️ AI presence 無變更")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
