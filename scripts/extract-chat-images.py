#!/usr/bin/env python3
"""
Extract base64-inline images from the current Claude Code session JSONL into a folder.

Why this exists
---------------
When the user pastes images into the Claude Code chat (Cmd+V from clipboard,
right-click-copy from browser, etc.), the IDE writes them as base64 blocks
into ``~/.claude/projects/<slug>/<session-id>.jsonl``. They are NOT staged as
real files anywhere else, so ``find /tmp`` and friends will miss them.

This script reads the session JSONL, finds every ``content[].type == "image"``
block whose ``source.type == "base64"``, and writes the bytes to disk.

Usage
-----
    # default — drop into ./refs/<slot>/
    python3 scripts/extract-chat-images.py docs/research/dashboard-redesign/refs/<slot>

    # specify the session JSONL explicitly (otherwise picks the most recent
    # one under ~/.claude/projects/-Users-chenkuichen-app-test/)
    python3 scripts/extract-chat-images.py <dest> --session <jsonl-path>

    # only the latest N images (e.g. user just pasted 3)
    python3 scripts/extract-chat-images.py <dest> --last 3

    # filename prefix
    python3 scripts/extract-chat-images.py <dest> --prefix slide
"""
from __future__ import annotations

import argparse
import base64
import json
import pathlib
import sys
from typing import Iterator


PROJECTS_DIR = pathlib.Path.home() / ".claude" / "projects"


def find_latest_session(project_slug: str | None = None) -> pathlib.Path:
    """Return the most-recently-modified .jsonl under ~/.claude/projects/.

    If project_slug is given (e.g. "-Users-chenkuichen-app-test"), search only
    that subdir. Otherwise search across all projects.
    """
    if project_slug:
        root = PROJECTS_DIR / project_slug
    else:
        root = PROJECTS_DIR
    candidates = list(root.rglob("*.jsonl"))
    if not candidates:
        sys.exit(f"no .jsonl under {root}")
    return max(candidates, key=lambda p: p.stat().st_mtime)


def iter_images(jsonl_path: pathlib.Path) -> Iterator[dict]:
    with jsonl_path.open() as f:
        for line in f:
            try:
                ev = json.loads(line)
            except json.JSONDecodeError:
                continue
            content = (ev.get("message") or {}).get("content")
            if not isinstance(content, list):
                continue
            for blk in content:
                if not (isinstance(blk, dict) and blk.get("type") == "image"):
                    continue
                src = blk.get("source") or {}
                if src.get("type") != "base64":
                    continue
                yield {
                    "media_type": src.get("media_type", "image/png"),
                    "data": src.get("data", ""),
                    "ts": ev.get("timestamp"),
                }


def ext_for(media_type: str) -> str:
    if "png" in media_type:
        return "png"
    if "jpeg" in media_type or "jpg" in media_type:
        return "jpg"
    if "webp" in media_type:
        return "webp"
    if "gif" in media_type:
        return "gif"
    return "bin"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dest", help="destination folder (created if missing)")
    ap.add_argument("--session", help="explicit session .jsonl (default: latest under ~/.claude/projects/)")
    ap.add_argument("--project", default="-Users-chenkuichen-app-test",
                    help="project slug under ~/.claude/projects/ (default: this repo)")
    ap.add_argument("--prefix", default="slide", help="output filename prefix (default: slide)")
    ap.add_argument("--last", type=int, default=0, help="only the last N images (default: all)")
    ap.add_argument("--start", type=int, default=1, help="numbering start (default: 1)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    session = pathlib.Path(args.session) if args.session else find_latest_session(args.project)
    print(f"session: {session}")

    images = list(iter_images(session))
    if args.last and args.last < len(images):
        images = images[-args.last:]
    print(f"found {len(images)} image(s)")

    dest = pathlib.Path(args.dest)
    if not args.dry_run:
        dest.mkdir(parents=True, exist_ok=True)

    for i, img in enumerate(images, args.start):
        out = dest / f"{args.prefix}-{i}.{ext_for(img['media_type'])}"
        action = "would write" if args.dry_run else "wrote"
        if not args.dry_run:
            out.write_bytes(base64.b64decode(img["data"]))
        size = len(base64.b64decode(img["data"])) if args.dry_run else out.stat().st_size
        print(f"  {action} {out}  ({size} bytes, ts={img['ts']})")

    return 0


if __name__ == "__main__":
    sys.exit(main())
