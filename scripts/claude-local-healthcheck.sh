#!/usr/bin/env bash
set -euo pipefail

echo "Claude Local Healthcheck"
echo
echo "ollama: $(command -v ollama)"
echo "claude: $(command -v claude)"
echo
python3 - <<'PY'
import subprocess
cmd=['ollama','launch','claude','-y','--model','qwen3:14b','--','--version']
r=subprocess.run(cmd,capture_output=True,text=True,timeout=20)
print("status: launcher reachable")
print(r.stdout.strip())
PY
echo
echo "note: local Claude over Ollama can launch and report version, but non-interactive prompt mode is still slow/unstable; use it as an interactive drafting assistant for now."
