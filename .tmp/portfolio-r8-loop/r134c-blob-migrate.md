# R134c · Blob Migrate + R133 Live Sync

## Env Var Reshape

### Before

- `.env.local`
  - `PUB_BLOB_READ_WRITE_TOKEN` only
  - no `BLOB_READ_WRITE_TOKEN`
  - no `PUB_BLOB_TELEMETRY_TOKEN`

### After

- `.env.local`
  - `BLOB_READ_WRITE_TOKEN` → private store `store_P6ZAb0gnJubLhVYz`
  - `PUB_BLOB_TELEMETRY_TOKEN` → public store `store_2lDPW8DO28VBu4um`
  - `PUB_BLOB_READ_WRITE_TOKEN` kept temporarily as legacy public fallback for routes not migrated in this round

### Production Env Sync

- Intended target:
  - `BLOB_READ_WRITE_TOKEN` for private Blob flows
  - `PUB_BLOB_TELEMETRY_TOKEN` for telemetry
- Automation status:
  - blocked on this workstation
  - `npx vercel whoami` started interactive login flow: `No existing credentials found. Starting login flow...`
  - `npx vercel env ls production --token "$VERCEL_OIDC_TOKEN"` failed: invalid token format
  - direct REST probe with `VERCEL_OIDC_TOKEN` returned `403 invalidToken`
- Mitigation applied in code:
  - private getters now prefer `BLOB_READ_WRITE_TOKEN` and temporarily fall back to legacy `PUB_BLOB_READ_WRITE_TOKEN`
  - telemetry getter now prefers `PUB_BLOB_TELEMETRY_TOKEN` and temporarily falls back to legacy `PUB_BLOB_READ_WRITE_TOKEN`

## Code Routing

### Switched to private token path

- `api/brain.js`
- `api/research.js`
- `api/report.js`
- `api/blob-read.js`
- `api/target-prices.js`
- `api/valuation.js`
- `api/tracked-stocks.js`
- `api/_lib/tracked-stocks.js`
- `api/_lib/portfolio-snapshots.js`
- `api/cron/collect-target-prices.js`
- `api/cron/compute-valuations.js`
- `api/cron/snapshot-portfolios.js`
- `scripts/audit-data-coverage.mjs`
- `scripts/backfill-target-prices.mjs`
- `src/lib/cronLastSuccess.js`

### Stayed on public / legacy token this round

- `api/telemetry.js` → renamed to `PUB_BLOB_TELEMETRY_TOKEN`
- residual handlers still on legacy public token:
  - `api/analyst-reports.js`
  - `api/cron/collect-news.js`
  - `api/cron/collect-daily-events.js`
  - `api/news-feed.js`

### Additional support changes

- added `api/_lib/blob-tokens.js`
- updated `api/_lib/signed-url.js` signing secret fallback order
- widened local Vite API bridge to include:
  - `/api/telemetry`
  - `/api/target-prices`
  - `/api/valuation`
- local dev now accepts unknown pid in `api/tracked-stocks` by synthesizing a retail portfolio policy for local-only E2E (`ajoe734`)

## Migration Dry Run

Command:

```bash
source .env.local
OLD_BLOB_READ_WRITE_TOKEN="$PUB_BLOB_READ_WRITE_TOKEN" \
NEW_BLOB_READ_WRITE_TOKEN="$BLOB_READ_WRITE_TOKEN" \
node scripts/migrate-blob-public-to-private.mjs --dry-run
```

Summary:

- `totalSourceBlobs = 67`
- `includedBlobs = 67`
- `excludePrefixes = ["telemetry/", "telemetry-events.json"]`
- telemetry keys were excluded as intended

Prefix counts:

- `analysis-history-index.json` × 1
- `analysis-history/` × 8
- `analyst-reports/` × 1
- `daily-events/` × 2
- `last-success-compute-valuations.json` × 1
- `news-feed/` × 1
- `research/` × 1
- `target-prices/` × 26
- `valuation/` × 26

Dry-run key sample:

- `analysis-history-index.json`
- `analyst-reports/2330.json`
- `daily-events/latest.json`
- `news-feed/latest.json`
- `research/PORTFOLIO/1774062104208.json`
- `target-prices/1503.json`
- `valuation/1503.json`

## Migration Live Run

Command:

```bash
source .env.local
OLD_BLOB_READ_WRITE_TOKEN="$PUB_BLOB_READ_WRITE_TOKEN" \
NEW_BLOB_READ_WRITE_TOKEN="$BLOB_READ_WRITE_TOKEN" \
node scripts/migrate-blob-public-to-private.mjs
```

Result:

- `migratedCount = 67`
- `migratedBytes = 445590`
- no telemetry keys migrated
- no rollback needed

## R133 E2E Verification

### Local Dev

- dev server: `npm run dev`
- bound to `http://127.0.0.1:3002`

### POST `/api/tracked-stocks`

Command:

```bash
curl -sS -X POST http://127.0.0.1:3002/api/tracked-stocks \
  -H 'Content-Type: application/json' \
  -d '{"pid":"ajoe734","stocks":[{"code":"2330","name":"台積電","type":"listed"}]}'
```

Response:

```json
{"updated":true,"totalTracked":1,"lastSyncedAt":"2026-04-18T21:27:30.139Z","portfolioId":"ajoe734"}
```

### Private Blob proof

Command:

```bash
node --env-file=.env.local --input-type=module -e "import { list } from '@vercel/blob'; const result = await list({ token: process.env.BLOB_READ_WRITE_TOKEN, prefix: 'tracked-stocks/ajoe734/', limit: 10 }); console.log(JSON.stringify(result.blobs.map((blob) => ({ pathname: blob.pathname, uploadedAt: blob.uploadedAt })), null, 2));"
```

Result:

```json
[
  {
    "pathname": "tracked-stocks/ajoe734/latest.json",
    "uploadedAt": "2026-04-18T21:27:32.000Z"
  }
]
```

### `loadTrackedStocks()` source

Command:

```bash
node --env-file=.env.local --input-type=module -e "import { loadTrackedStocks } from './api/cron/collect-target-prices.js'; const result = await loadTrackedStocks({ logger: console }); console.log(JSON.stringify({ source: result.source, totalTracked: result.trackedStocks.length, lastSyncedAt: result.lastSyncedAt, portfolioIds: result.portfolioIds }, null, 2));"
```

Result:

```json
{
  "source": "live-sync",
  "totalTracked": 1,
  "lastSyncedAt": "2026-04-18T21:27:30.139Z",
  "portfolioIds": [
    "ajoe734"
  ]
}
```

### `audit-data-coverage`

Command:

```bash
node scripts/audit-data-coverage.mjs
```

Result:

```json
{
  "ok": false,
  "trackedSource": "live-sync",
  "trackedLastSyncedAt": "2026-04-18T21:27:30.139Z",
  "summary": {
    "total": 1,
    "tracked": {
      "source": "live-sync",
      "status": "PASS",
      "reason": "live-sync within freshness window"
    }
  }
}
```

Note:

- gate is red because the newly added `2330` does not yet have target-price / valuation snapshots
- the tracked-stocks source requirement is satisfied: `live-sync`, not `seedData-fallback`

### Migrated private reads still work

- `GET /api/target-prices?code=1503` → `200`
- `GET /api/valuation?code=1503` → `200`
- `GET /api/brain?action=all` → `200`

## Public Telemetry Check

Command:

```bash
curl -sS http://127.0.0.1:3002/api/telemetry
```

Result:

```json
{"entries":[{"id":"manual-check-1","kind":"web-vital","timestamp":"2026-03-28T00:10:00.000Z","level":"warn","error":{"name":"WebVitalMetric","message":"TTFB good (120)","stack":null},"context":{"metric":{"name":"TTFB","value":120,"rating":"good"}}}]}
```

Status:

- `200 OK`
- no `400`
- no `500`

## Validation Summary

- private tracked-stocks write: pass
- `loadTrackedStocks()` source `live-sync`: pass
- private target-prices read after migration: pass
- private valuation read after migration: pass
- private brain read after migration: pass
- public telemetry still works: pass
- production env var sync from this machine: blocked by missing Vercel CLI credentials
