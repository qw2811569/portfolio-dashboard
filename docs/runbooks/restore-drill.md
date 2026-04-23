# Restore Drill

Status: `runbook-only`

- scope: `T64` restore drill / rollback test / MDD recovery, plus `O03` monthly rehearsal
- cadence:
  - daily snapshot: `03:00 Asia/Taipei` (`R120 Q-I3`)
  - monthly rehearsal: first trading day `10:00 Asia/Taipei` (`R120 Q-I3`)
- executor: owner manual, human-in-the-loop
- guardrail: staging only; do not restore directly into prod runtime or prod browser state

## Canonical Sources

- Architecture §2.1 Deployment View: `VM Worker` owns cron / long jobs / orchestration; `brain / research / snapshot` live in private Blob; runbook is part of production topology.
- Architecture §2.2 Data Flow View + Flow C: `Worker -> Blob -> Logs`; restore lane must leave `schemaVersion`, `last-success`, metrics, and restore evidence.
- Architecture §6:
  - Q3: restore minimum lane is `T57 + T62 + slim T64`.
  - internal beta is stability-first, so restore is ship-before, not post-launch polish.
- SA §4.2 + §6.10 Insider 7865 / insider rules: insider portfolio recovery must stay in risk / state / compliance wording; no AI buy-sell advice during degraded recovery.
- SA §6 functional requirements: Morning Note / Close Analysis / Weekly output are functional lanes; degraded mode may read last good artifact, but must show staleness explicitly.
- `docs/portfolio-spec-report/todo.md`:
  - `T62`: checkpoint / backup contract already extends to localStorage truth.
  - `T64`: restore drill, rollback test, and MDD recovery are required and evidenced.
  - `O03`: monthly restore rehearsal reuses one evidence template.

## 1. Snapshot Contract

### 1.1 Canonical Contract

- source: `VM Worker` cron, not Vercel cron and not VM-local ad hoc copy
- destination: private Vercel Blob for shared artifacts; VM local is staging / fallback only, never canonical
- required evidence: restore run must emit logs / checksums / screenshots / append entry in `docs/runbooks/restore-drill-log.md`
- privacy: artifacts containing portfolio or insider state stay private; telemetry may remain public per `T49`, but restore artifacts do not

### 1.2 Scope Matrix

The architecture names the logical lanes as `snapshot/research/*`, `snapshot/brain/*`, `snapshot/portfolio-state/*`, plus the `localStorage checkpoint` added by `T62`.

`R121 §11` now materializes the canonical daily snapshot tree into private Blob. During restore rehearsal, prefer the dated snapshot lanes plus `snapshot/daily-manifest/<date>.json`; the older live keys remain the upstream source artifacts that the worker mirrors from.

| Logical lane                 | Canonical intent                           | Current physical keys seen in repo                                                                                                                                         | Restore note                                                                                                    |
| ---------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `snapshot/research/*`        | private Blob research artifacts            | `snapshot/research/<date>/research-index.json`, `snapshot/research/<date>/portfolio-<pid>-research-history.json`                                                           | restore from the dated snapshot first; only fall back to legacy `research-index.json` if the manifest is absent |
| `snapshot/brain/*`           | private Blob strategy / analysis artifacts | `snapshot/brain/<date>/strategy-brain.json`, `snapshot/brain/<date>/analysis-history-index.json`, `snapshot/brain/<date>/analysis-history/*`                               | restore from the dated snapshot first; legacy `strategy-brain.json` / `analysis-history/*` remain source lanes  |
| `snapshot/portfolio-state/*` | private Blob portfolio runtime state       | `snapshot/portfolio-state/<date>/<pid>/holdings.json`, `tradeLog.json`, `targets.json`, `fundamentals.json`, `newsEvents.json`                                             | owner `me` holdings/news events can also be mirrored back into `data/holdings.json` / `data/events.json`        |
| `localStorage checkpoint`    | browser truth per `T62`                    | `snapshot/localStorage-checkpoint/<date>.json` plus local mirror `.tmp/localstorage-backups/latest.json` / VM mirror `/home/chenkuichen/portfolio-backups/YYYY-MM-DD.json` | Blob copy is now canonical for drill selection; local / VM mirrors stay as operator fallback                    |

### 1.3 Retention

- ACL: private for `brain / research / snapshot`; telemetry is the only explicit public exception (`T49`)
- current retention truth: no dedicated retention doc exists yet
- until `O06` lands, use this operating default:
  - hot retention: keep the latest `30` days as the normal restore window
  - cold retention: retain up to `90` days in private Blob, then purge with the manual retention script
  - never delete any artifact referenced by an active anchor branch, release note, or `docs/runbooks/restore-drill-log.md`

### 1.4 Current Gaps To Treat As Known Variance

- legacy live keys (`strategy-brain.json`, `research-index.json`, `holdings.json`, `events.json`) still exist because the worker snapshots them into the dated restore tree; treat the dated tree as restore source of truth
- the dated `last-success/daily-snapshot/<date>.txt` marker is supplementary; automation truth still reads `last-success-daily-snapshot.json`

## 2. Monthly Restore Drill

Run on the first trading day of each month at `10:00 Asia/Taipei`. This is a rehearsal only. It must not point at prod directories, prod cookies, or prod browser state.

### Step 0 · Preflight And Staging Isolation

Command:

```bash
export DRILL_TS="$(TZ=Asia/Taipei date +%Y%m%d-%H%M%S)"
export DRILL_ROOT="$HOME/restore-drills/$DRILL_TS"
export DRILL_REPO="$DRILL_ROOT/repo"
export DRILL_DOWNLOAD="$DRILL_ROOT/download"
export DRILL_EVIDENCE="$DRILL_ROOT/evidence"
export DRILL_SOURCE_REPO="$(git rev-parse --show-toplevel)"

mkdir -p "$DRILL_DOWNLOAD" "$DRILL_EVIDENCE"
git worktree add "$DRILL_REPO" HEAD

case "$DRILL_REPO" in
  /var/www/app/current/dist*|/var/www/portfolio-report*)
    echo "refuse prod path"
    exit 1
    ;;
esac

test -f "$HOME/.ssh/google_compute_engine"
test -n "${BLOB_READ_WRITE_TOKEN:-}"
test -f ".tmp/localstorage-backups/latest.json" || {
  echo "missing localStorage checkpoint: run node scripts/backup-to-vm.mjs /path/to/portfolio-backup-YYYY-MM-DD.json first"
  exit 1
}
```

Verify:

- worktree path is under `$HOME/restore-drills/*`, not a prod root
- `~/.ssh/google_compute_engine` exists
- Blob token exists in env
- latest localStorage export exists before continuing

Rollback if fail:

- stop immediately
- `git worktree remove "$DRILL_REPO" --force 2>/dev/null || true`
- `rm -rf "$DRILL_ROOT"`
- do not continue with any restore command against prod

### Step 1 · Select Snapshot Date

Command:

```bash
cd "$DRILL_REPO"

node --input-type=module <<'EOF'
import { list } from '@vercel/blob'

const token = process.env.BLOB_READ_WRITE_TOKEN
const { blobs } = await list({ prefix: 'snapshot/daily-manifest/', token, limit: 1000 })
for (const blob of (blobs || []).sort((a, b) => String(a.pathname).localeCompare(String(b.pathname)))) {
  console.log(blob.pathname)
}
EOF

export SNAPSHOT_DATE="<YYYY-MM-DD>"
```

Verify:

- chosen `SNAPSHOT_DATE` is one of the latest daily `03:00 Asia/Taipei` runs
- selected date is not older than the latest expected trading-day artifact without owner signoff
- if a `last-success` marker later exists for this job, it matches the chosen date

Rollback if fail:

- do not pick an unknown older snapshot silently
- either choose the previous valid daily snapshot explicitly, or abort and wait for owner decision

### Step 2 · Download Private Blob Artifacts Into Staging

Command:

```bash
cd "$DRILL_REPO"

node --input-type=module <<'EOF'
import { get } from '@vercel/blob'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const token = process.env.BLOB_READ_WRITE_TOKEN
const snapshotDate = process.env.SNAPSHOT_DATE
const outDir = process.env.DRILL_DOWNLOAD

const manifestBlob = await get(`snapshot/daily-manifest/${snapshotDate}.json`, {
  access: 'private',
  token,
  useCache: false,
})
const manifest = JSON.parse(await new Response(manifestBlob.stream).text())

for (const file of manifest.files || []) {
  const blob = await get(file.pathname, { access: 'private', token, useCache: false })
  const body = await new Response(blob.stream).text()
  const target = join(outDir, file.pathname)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, body)
  console.log(target)
}
EOF
```

Verify:

- expected files exist under `$DRILL_DOWNLOAD`
- `snapshot/localStorage-checkpoint/<date>.json` exists alongside the Blob download
- missing files are recorded explicitly; they are not silently ignored

Rollback if fail:

- delete the incomplete download set: `rm -rf "$DRILL_DOWNLOAD" && mkdir -p "$DRILL_DOWNLOAD"`
- either re-run Step 2 once, or abort and mark the drill `blocked`

### Step 3 · Checksum And Schema Validation

Command:

```bash
cd "$DRILL_REPO"

find "$DRILL_DOWNLOAD" -type f -name '*.json' -print0 | \
  xargs -0 shasum -a 256 | tee "$DRILL_EVIDENCE/checksums.sha256"

node --input-type=module <<'EOF'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { normalizePortfolioSnapshot } from './api/_lib/portfolio-snapshots.js'

const root = process.env.DRILL_DOWNLOAD

function walk(dir) {
  const output = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) output.push(...walk(full))
    else output.push(full)
  }
  return output
}

for (const file of walk(root).filter((value) => value.endsWith('.json'))) {
  JSON.parse(readFileSync(file, 'utf8'))
}

const localBackup = JSON.parse(readFileSync(join(root, 'localstorage-checkpoint.json'), 'utf8'))
if (localBackup.app !== 'portfolio-dashboard') throw new Error('invalid localStorage backup app')
if (Number(localBackup.version) !== 1) throw new Error('invalid localStorage backup version')
if (!Number.isFinite(Number(localBackup.storage?.['pf-schema-version']))) {
  throw new Error('localStorage checkpoint missing pf-schema-version')
}

for (const file of walk(join(root, 'portfolios')).filter((value) => value.endsWith('.json'))) {
  normalizePortfolioSnapshot(JSON.parse(readFileSync(file, 'utf8')))
}

console.log('schema-ok')
EOF
```

Verify:

- `checksums.sha256` is created
- JSON parse succeeds for every downloaded artifact
- localStorage checkpoint has `app=portfolio-dashboard`, `version=1`, and `pf-schema-version`
- every daily snapshot passes `normalizePortfolioSnapshot(...)`

Rollback if fail:

- do not apply anything into staging
- choose a different daily snapshot or request a fresh localStorage export
- record failure in evidence and keep prod untouched

### Step 4 · Apply Into Staging Repo And Browser State

Command:

```bash
cd "$DRILL_REPO"

node --input-type=module <<'EOF'
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const downloadRoot = process.env.DRILL_DOWNLOAD
const dataDir = join(process.env.DRILL_REPO, 'data')

function walk(dir) {
  const output = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) output.push(...walk(full))
    else output.push(full)
  }
  return output
}

if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })

for (const file of walk(downloadRoot).filter((value) => value.endsWith('.json'))) {
  const rel = relative(downloadRoot, file)
  if (rel.startsWith('portfolios/')) continue
  if (rel === 'localstorage-checkpoint.json') continue
  const target = join(dataDir, rel.replace(/\//g, '__'))
  cpSync(file, target)
  console.log(`${file} -> ${target}`)
}
EOF

bash scripts/redeploy-local.sh
```

Manual browser action:

1. open the staging app at `http://127.0.0.1:3002`
2. import `$DRILL_DOWNLOAD/localstorage-checkpoint.json` through the app's backup import flow
3. confirm the active portfolio, notes, pid-scoped data, and view mode all load from the imported checkpoint

Verify:

- stage `data/` contains the restored brain / analysis / research / portfolio mirrors
- stage app boots after `scripts/redeploy-local.sh`
- imported localStorage checkpoint restores pid-scoped holdings / notes / prefs without schema rejection

Rollback if fail:

- delete the staging worktree instead of trying in-place repair
- `git worktree remove "$DRILL_REPO" --force`
- `rm -rf "$DRILL_ROOT"`
- rebuild a clean stage and restart from Step 0

### Step 5 · Smoke Test The Restored Stage

Default: use staging mode for `scripts/full-smoke.mjs` so the rehearsal stays inside the isolated local stage and skips prod/VM remote probes.

Command:

```bash
cd "$DRILL_REPO"

FULL_SMOKE_SKIP_REMOTE_CHECKS=1 FULL_SMOKE_LOCAL_URL=http://127.0.0.1:3002 \
  PORTFOLIO_BASE_URL=http://127.0.0.1:3002/ \
  node scripts/full-smoke.mjs
```

Verify:

- local verify passes
- build passes
- targeted persistence / snapshot tests pass
- golden-path stage smoke passes on the restored data

Rollback if fail:

- mark the rehearsal `fail`
- keep the stage workspace for debugging, but do not promote anything to prod
- append evidence with failing command and output location

### Step 6 · Manual UI Verification

Command:

```bash
curl -sI http://127.0.0.1:3002/ | head -n 1
curl -sI http://127.0.0.1:3002/portfolio/me/holdings | head -n 1
curl -sI http://127.0.0.1:3002/portfolio/me/research | head -n 1
curl -sI http://127.0.0.1:3002/portfolio/me/daily | head -n 1
```

Manual verification:

- Holdings renders restored holdings / notes / filters correctly
- Research renders `strategy-brain` / history without blank panels
- Daily renders without crashing and shows stale / degraded truth if any artifact is old
- insider portfolio `7865` remains in risk / compliance wording only; no buy-sell advice appears

Rollback if fail:

- keep prod untouched
- clear imported browser state in staging, discard the worktree, and reopen a bug instead of forcing a dirty stage fix

### Step 7 · Capture Restore Evidence

Command:

```bash
cd "$DRILL_SOURCE_REPO"

cat <<EOF >> docs/runbooks/restore-drill-log.md
## $(TZ=Asia/Taipei date '+%Y-%m-%d %H:%M:%S %Z') · monthly restore rehearsal

- date: $(TZ=Asia/Taipei date '+%Y-%m-%d')
- verifier: <owner-name>
- git sha: $(git -C "$DRILL_REPO" rev-parse --short HEAD)
- snapshot source: ${SNAPSHOT_DATE}
- localStorage checkpoint: ${DRILL_DOWNLOAD}/localstorage-checkpoint.json
- checksum manifest: ${DRILL_EVIDENCE}/checksums.sha256
- step outcome: Step0=<pass/fail>; Step1=<pass/fail>; Step2=<pass/fail>; Step3=<pass/fail>; Step4=<pass/fail>; Step5=<pass/fail>; Step6=<pass/fail>
- elapsed: <mm:ss>
- screenshots: <paths>
- verifier notes: <notes>
- follow-up: <ticket-or-none>

EOF
```

Verify:

- log append exists in `docs/runbooks/restore-drill-log.md`
- entry includes date / sha / snapshot source / step outcome / verifier
- screenshot paths and checksum manifest path are recorded

Rollback if fail:

- the drill does not count as complete until evidence exists
- fix the log entry immediately before cleaning staging

### Step 8 · Clean Up Staging

Command:

```bash
git worktree remove "$DRILL_REPO" --force
rm -rf "$DRILL_ROOT"
```

Manual cleanup:

- clear the staging browser's localStorage after screenshots are secured
- if a stage-only process manager was used, restart it only after evidence is written

Verify:

- no restore-drill files remain outside the evidence paths you intentionally kept
- prod runtime and prod browser state were never touched

Rollback if fail:

- if cleanup fails, leave the staging tree isolated and marked `do-not-promote`
- do not reuse a half-cleaned stage for the next rehearsal

## 3. Rollback Test

Trigger: prod is bad enough that code rollback is faster than forward fix. Architecture §6 already treats restore as ship-before; rollback is therefore a timed operational lane, not an ad hoc workaround.

### 3.1 Time Budget

- total target: `< 15 min`
- git layer target: `< 5 min`
- asset layer target: `< 10 min`

### 3.2 Git Layer

Use the pre-cut anchor branch pattern `backup/pre-r138-<timestamp>` or the latest equivalent backup branch for the current release.

Command:

```bash
git fetch origin --prune
git branch -r | rg 'backup/pre-r138-|backup/pre-r[0-9]+-'

# example from current release note
git push --force-with-lease origin backup/pre-r138-20260424-011724:main
git ls-remote origin main backup/pre-r138-20260424-011724
```

Verify:

- remote `main` now points at the anchor SHA
- Vercel starts or exposes the deployment matching the anchor commit

Rollback if fail:

- stop after one retry
- do not chain multiple force pushes
- escalate to owner with the exact failing command and current remote SHA

### 3.3 Asset Layer

Run git rollback and asset rollback as dual track; do not assume one fixes the other.

- Vercel:
  - promote the previous `READY` deployment in Vercel dashboard
  - verify landing page returns `200` and asset hash matches the target deployment
- VM root:

Command:

```bash
node scripts/sync-to-vm-root.mjs
curl -sI https://35.236.155.62.sslip.io/ | head
curl -s https://35.236.155.62.sslip.io/ | grep -oE 'index-[A-Za-z0-9]+\\.js' | head -1
```

Verify:

- root URL returns `200`
- VM root asset hash matches the intended rollback target
- `portfolio-report/` preserved path is still present after sync

Rollback if fail:

- keep the git rollback in place
- mark VM root as degraded and do not re-promote prod traffic assumptions until sync passes

### 3.4 Data Layer

After git + asset rollback, restore data separately:

- private Blob snapshot: restore from the chosen daily snapshot in this runbook
- browser localStorage: clear prod browser state and re-import the checkpoint from `T62`

Verify:

- code, assets, and data all point to the same rollback moment
- no cross-version mix between old code and newer browser state remains

## 4. MDD (Maximum Data Divergence) Recovery

MDD here means `Maximum Data Divergence`, not the portfolio KPI's market drawdown metric.

### 4.1 Definition

Treat divergence on three axes:

| Axis                  | Green                              | Yellow                                         | Red                                                    |
| --------------------- | ---------------------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| snapshot age          | `<= 24h` behind current wall clock | `> 24h` and `<= 72h`                           | `> 72h`                                                |
| artifact completeness | all four lanes present             | one lane missing but last good artifact exists | Blob + localStorage checkpoint both missing or corrupt |
| schema integrity      | checksum and schema both pass      | recoverable with previous daily snapshot       | corrupt + no previous valid snapshot                   |

Hard rule:

- anything above `24h` is beyond the normal tolerance for prod promote
- if divergence is yellow or red, recovery may use last good artifacts, but UI must surface stale / degraded state per Architecture §2.2
- for insider `7865`, yellow / red recovery is read-only / compliance wording only

### 4.2 Scenario Paths

#### Scenario A · Daily snapshot missing, localStorage checkpoint still valid

Path:

1. restore the browser truth first from the `T62` checkpoint
2. restore `brain / research / holdings / events` from the last good private Blob artifacts
3. rebuild stage and verify degraded badge / timestamp appear
4. do not promote to prod until a fresh daily snapshot exists

#### Scenario B · Snapshot file exists but checksum or schema fails

Path:

1. reject the corrupt file
2. step back to the previous dated daily snapshot
3. re-run Step 3 validation
4. append a failed-artifact entry to `restore-drill-log.md`

#### Scenario C · Snapshot older than 24 hours

Path:

1. restore into staging only
2. verify that stale / degraded UI truth is explicit
3. freeze any prod-facing write or promotion decision
4. wait for owner signoff and a fresh snapshot before leaving degraded mode

#### Scenario D · Blob artifact missing and localStorage checkpoint also missing

Path:

1. declare `red` immediately
2. do not fake a clean restore from partial data
3. recover from the latest git checkpoint / release anchor plus any surviving VM backup mirror
4. keep prod in hold / degraded mode until owner manually reconstructs browser truth

### 4.3 Recovery Exit Criteria

Recovery is only considered complete when all are true:

- chosen artifact is `<= 24h` old or explicitly accepted by owner
- checksum + schema validation passed
- stage smoke passed
- UI shows correct stale / degraded state when appropriate
- evidence entry was appended

## 5. Restore Evidence

Every drill, rollback test, or MDD recovery event appends one entry to `docs/runbooks/restore-drill-log.md`.

Minimum fields:

- date
- verifier
- git sha
- snapshot source
- localStorage checkpoint path
- step outcome
- elapsed
- screenshot paths
- checksum manifest path
- follow-up ticket or `none`

Pass criteria for `T64` / `O03`:

- runbook exists
- drill is repeatable
- evidence is appended, not kept only in shell history
- duration and outcome are captured in one place

## 6. Pitfall Warnings

The brief points to `memory/feedback_vm_deploy_pitfalls.md`, but that file is not present in this workspace snapshot. The warnings below are reconstructed from downstream references in `docs/product/agent-bridge-spec.md`, `.tmp/bridge-localactivity-persist/brief.md`, and `.tmp/portfolio-r8-loop/codex-r96.log`.

- SSH key: always use `~/.ssh/google_compute_engine` with `-o IdentitiesOnly=yes`
- `scp` pitfall: sending many files straight into a protected directory fails easily; send to a temp home dir first or use `rsync`
- `pm2 restart` pitfall: it clears in-memory runtime state; if the drill touches a pm2-managed stage process, capture evidence first, then restart deliberately
- WS auth pitfall: do not tighten Agent Bridge websocket auth until anonymous/read vs operator/write paths are separated; overly strict auth can break the bridge during recovery
- prod path pitfall: do not copy directly into `/var/www/app/current/dist` or `/var/www/portfolio-report` during rehearsal

## 7. Known Contradictions To Resolve Later

- architecture treats Blob as restore canonical, but `api/brain.js` and `api/research.js` still use local-first file caches with Blob mirror
- the logical `snapshot/research/*` / `snapshot/brain/*` namespaces are not yet implemented as one physical prefix
- `T62` says localStorage truth is in contract, but current repo still mirrors it to `.tmp/` + VM backup instead of Blob
- `scripts/full-smoke.mjs` is a ship-gate script, not a clean staging-only restore script; use the sub-set above unless it is refactored
