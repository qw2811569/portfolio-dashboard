#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { buildProgressSnapshot } from '../docs/portfolio-spec-report/progress.js'

const root = process.cwd()
const todoPath = path.resolve(root, 'docs/portfolio-spec-report/todo.md')
const progressPath = path.resolve(root, 'docs/portfolio-spec-report/progress.json')
const velocityHoursPerDay = 8
const opsBaselineHours = 4

const args = process.argv.slice(2)
const markDoneIds = args
  .filter((arg) => !arg.startsWith('--'))
  .map((arg) => arg.trim())
  .filter(Boolean)

const readJson = (filePath) => {
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

const extractSection = (markdown, startHeading, endHeading) => {
  const start = markdown.indexOf(startHeading)
  if (start === -1) return ''
  const fromStart = markdown.slice(start + startHeading.length)
  if (!endHeading) return fromStart
  const end = fromStart.indexOf(endHeading)
  return end === -1 ? fromStart : fromStart.slice(0, end)
}

const parseTableRows = (block) => {
  const rows = []
  let inTable = false

  for (const line of block.split('\n')) {
    if (line.startsWith('| ID') || line.startsWith('| T-ID')) {
      inTable = true
      continue
    }

    if (!inTable) continue

    if (!line.trim() || !line.startsWith('|')) {
      inTable = false
      continue
    }

    if (/^\|\s*-/.test(line)) continue

    rows.push(line.split('|').slice(1, -1).map((cell) => cell.trim()))
  }

  return rows
}

const buildSeedItems = (markdown, existingItems = []) => {
  const existingById = new Map(existingItems.map((item) => [item.id, item]))
  const sections = [
    {
      track: 'shipBefore',
      start: '## 2. 30 條 Ship-Before',
      end: '## 3. 20 條 Beta+1',
      toItem: (row) => ({ id: row[0], title: row[1], estH: Number(row[3]) }),
    },
    {
      track: 'beta1',
      start: '## 3. 20 條 Beta+1',
      end: '## 4. 19 條 Backlog',
      toItem: (row) => ({ id: row[0], title: row[1], estH: Number(row[3]) }),
    },
    {
      track: 'backlog',
      start: '## 4. 19 條 Backlog',
      end: '## 5. Phase 2 Top Debt',
      toItem: (row) => ({ id: row[0], title: row[1], estH: Number(row[3]) }),
    },
    {
      track: 'qa',
      start: '## 9. R118 QA Candidate Supplement',
      end: '## 10. R118 Recurring Ops',
      toItem: (row) => ({ id: row[0], title: row[1], estH: Number(row[3]) }),
    },
    {
      track: 'ops',
      start: '## 10. R118 Recurring Ops',
      end: '## 11. R119 Executability Matrix',
      toItem: (row) => ({ id: row[0], title: row[1], estH: opsBaselineHours }),
    },
  ]

  const seedItems = []
  let sortOrder = 1

  for (const section of sections) {
    const block = extractSection(markdown, section.start, section.end)
    const rows = parseTableRows(block)

    for (const row of rows) {
      const seed = section.toItem(row)
      if (!seed.id || !seed.title || !Number.isFinite(seed.estH)) continue

      const previous = existingById.get(seed.id)

      seedItems.push({
        id: seed.id,
        title: seed.title,
        track: section.track,
        estH: seed.estH,
        done: previous?.done ?? false,
        completedAt: previous?.completedAt ?? null,
        sortOrder: sortOrder++,
      })
    }
  }

  const duplicates = seedItems.filter(
    (item, index, array) => array.findIndex((candidate) => candidate.id === item.id) !== index
  )
  if (duplicates.length > 0) {
    throw new Error(`Duplicate IDs in todo.md: ${duplicates.map((item) => item.id).join(', ')}`)
  }

  return seedItems
}

const markdown = fs.readFileSync(todoPath, 'utf8')
const existing = readJson(progressPath) ?? {}
const seedItems = buildSeedItems(markdown, existing.items ?? [])
const seedById = new Map(seedItems.map((item) => [item.id, item]))

if (markDoneIds.length > 0) {
  const missing = markDoneIds.filter((id) => !seedById.has(id))
  if (missing.length > 0) {
    console.error(`Unknown todo IDs: ${missing.join(', ')}`)
    process.exit(1)
  }

  const completedAt = new Date().toISOString()
  for (const id of markDoneIds) {
    const item = seedById.get(id)
    item.done = true
    item.completedAt = item.completedAt ?? completedAt
  }
}

const snapshot = buildProgressSnapshot({
  ...existing,
  lastUpdatedAt: new Date().toISOString(),
  velocityHoursPerDay: Number(existing.velocityHoursPerDay) || velocityHoursPerDay,
  items: seedItems,
})

fs.writeFileSync(progressPath, `${JSON.stringify(snapshot, null, 2)}\n`)

const idsLabel = markDoneIds.length > 0 ? `Marked done: ${markDoneIds.join(', ')}` : 'Rebuilt progress snapshot'
console.log(idsLabel)
console.log(
  `Ship-Before ${snapshot.byStatus.shipBefore.done}/${snapshot.byStatus.shipBefore.total} · ${snapshot.completionPct.toFixed(1)}% · ETA ${snapshot.etaDaysToShipBefore ?? '—'}d`
)
console.log(
  `Full Product ETA ${snapshot.etaDaysToFullProduct ?? '—'}d · All Tracked ETA ${snapshot.etaDaysToAllTracked ?? '—'}d`
)

// Auto-sync to VM so dashboard donut reflects update immediately (R121 added)
try {
  const { execSync } = await import('node:child_process')
  const SSH_KEY = process.env.GCE_SSH_KEY || `${process.env.HOME}/.ssh/google_compute_engine`
  const VM_HOST = process.env.VM_HOST || 'chenkuichen@35.236.155.62'
  const VM_PATH = process.env.VM_PROGRESS_PATH || '/var/www/app/current/dist/portfolio-report/progress.json'
  execSync(
    `scp -q -i "${SSH_KEY}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no "${progressPath}" "${VM_HOST}:${VM_PATH}"`,
    { stdio: 'pipe' }
  )
  console.log('VM progress.json synced · dashboard will refresh')
} catch (e) {
  console.warn('VM sync skipped/failed (offline? no SSH key?) · local only · ' + e.message)
}
