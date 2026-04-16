#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

agent=""
brief=""
task_id=""
callback=""
wait_mode=1

usage() {
  cat <<'EOF'
Usage:
  bash scripts/bridge-remote-dispatch.sh --agent codex|qwen|gemini [--task-id TASK_ID] [--callback URL] [--wait|--no-wait] <brief-or-file>

Env:
  AGENT_BRIDGE_REMOTE_URL      VM Agent Bridge base URL
  AGENT_BRIDGE_REMOTE_TOKEN    Bearer token for /api/workers/dispatch
  AGENT_BRIDGE_REMOTE_TIMEOUT_SEC  Poll timeout in seconds (default 1800)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent)
      agent="${2:-}"
      shift 2
      ;;
    --task-id)
      task_id="${2:-}"
      shift 2
      ;;
    --callback)
      callback="${2:-}"
      shift 2
      ;;
    --wait)
      wait_mode=1
      shift
      ;;
    --no-wait)
      wait_mode=0
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      if [[ -z "$brief" && -f "$1" && -r "$1" ]]; then
        brief="$(cat "$1")"
      elif [[ -z "$brief" ]]; then
        brief="$1"
      else
        brief="${brief} $1"
      fi
      shift
      ;;
  esac
done

if [[ -z "$agent" || -z "${brief// }" ]]; then
  usage >&2
  exit 2
fi

remote_url="${AGENT_BRIDGE_REMOTE_URL:-}"
remote_token="${AGENT_BRIDGE_REMOTE_TOKEN:-}"
timeout_sec="${AGENT_BRIDGE_REMOTE_TIMEOUT_SEC:-1800}"

if [[ -z "$remote_url" || -z "$remote_token" ]]; then
  echo "remote-vm requires AGENT_BRIDGE_REMOTE_URL and AGENT_BRIDGE_REMOTE_TOKEN" >&2
  exit 2
fi

if [[ -z "$task_id" ]]; then
  task_id="${agent}-$(date +%Y%m%d-%H%M%S)"
fi

payload="$(node -e "console.log(JSON.stringify({agent:process.argv[1], brief:process.argv[2], taskId:process.argv[3], callback:process.argv[4]}))" -- "$agent" "$brief" "$task_id" "$callback")"

dispatch_json="$(curl -fsS \
  -H "Authorization: Bearer ${remote_token}" \
  -H "Content-Type: application/json" \
  -X POST "${remote_url%/}/api/workers/dispatch" \
  -d "$payload")"

if [[ "$wait_mode" -eq 0 ]]; then
  echo "$dispatch_json"
  exit 0
fi

deadline=$(( $(date +%s) + timeout_sec ))
status_url="${remote_url%/}/api/workers/dispatch/${task_id}"

while true; do
  current_json="$(curl -fsS -H "Authorization: Bearer ${remote_token}" "$status_url")"
  done_state="$(node -e "const data=JSON.parse(process.argv[1]); process.stdout.write(String(Boolean(data.done)))" -- "$current_json")"
  if [[ "$done_state" == "true" ]]; then
    echo "$current_json"
    exit 0
  fi
  if [[ "$(date +%s)" -ge "$deadline" ]]; then
    echo "$current_json"
    echo "remote-vm dispatch timed out while waiting for completion" >&2
    exit 124
  fi
  sleep 2
done
