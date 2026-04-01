#!/bin/bash
# kb-experiment.sh — autoresearch-style experiment loop for knowledge base quality
# Usage: called by Claude after each batch of KB edits
# Measures: vague action ratio, retrieval coverage, simplified Chinese violations

set -euo pipefail

KB_DIR="src/lib/knowledge-base"
RESULTS_FILE="docs/superpowers/kb-experiment-results.tsv"

# Create results file with header if not exists
if [ ! -f "$RESULTS_FILE" ]; then
  mkdir -p "$(dirname "$RESULTS_FILE")"
  printf "commit\tvague_pct\ttotal\tvague_count\tstatus\tdescription\n" > "$RESULTS_FILE"
fi

# Run the measurement
node -e "
const fs = require('fs');
const dir = '$KB_DIR';
const actionPat = /\d+%|\d+倍|\d+元|\d+成|>=|<=|>|<|買進|賣出|減碼|加碼|停損|停利|續抱|觀望|警戒|布局/;
const simpPat = /[个开余节杠并关对进这让该说还没为从们]/;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json' && f !== 'quality-validation.json');
let total = 0, vague = 0, simp = 0;
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(dir+'/'+f, 'utf-8'));
  if (!d.items) continue;
  for (const item of d.items) {
    total++;
    if (!actionPat.test(item.action || '')) vague++;
    for (const field of ['title','fact','interpretation','action']) {
      if (simpPat.test(item[field] || '')) simp++;
    }
  }
}
const pct = (vague/total*100).toFixed(1);
console.log(JSON.stringify({ total, vague, pct, simp }));
"
