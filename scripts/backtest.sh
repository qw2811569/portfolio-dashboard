#!/usr/bin/env bash
set -euo pipefail

DATE=""
CODE="all"
ROUNDS="10"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --date)
      DATE="$2"
      shift 2
      ;;
    --code)
      CODE="$2"
      shift 2
      ;;
    --rounds)
      ROUNDS="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

BACKTEST_DATE="$DATE" BACKTEST_CODE="$CODE" BACKTEST_ROUNDS="$ROUNDS" node --input-type=module <<'EOF'
import { runBacktestBatch } from './src/lib/backtestRuntime.js'

const date = process.env.BACKTEST_DATE || ''
const code = process.env.BACKTEST_CODE || 'all'
const rounds = Number(process.env.BACKTEST_ROUNDS || '10')

const report = await runBacktestBatch({
  date: date || undefined,
  code,
  rounds,
})

console.log(JSON.stringify(report, null, 2))
EOF
