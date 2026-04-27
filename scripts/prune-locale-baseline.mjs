#!/usr/bin/env node
// Prune .locale-known-fails.json: keep only entries whose text is still present
// in the current source. Stale entries (already cleaned at source) are dropped.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const KNOWN_FAILS_PATH = join(ROOT, '.locale-known-fails.json')

if (!existsSync(KNOWN_FAILS_PATH)) {
  console.error('no .locale-known-fails.json found')
  process.exit(1)
}

const entries = JSON.parse(readFileSync(KNOWN_FAILS_PATH, 'utf8'))
const before = entries.length

const kept = entries.filter((entry) => {
  if (!entry.file) return true
  const filePath = join(ROOT, entry.file)
  if (!existsSync(filePath)) return false
  const content = readFileSync(filePath, 'utf8')
  return content.includes(entry.text)
})

const dropped = before - kept.length
writeFileSync(KNOWN_FAILS_PATH, JSON.stringify(kept, null, 2) + '\n')
console.log(`pruned ${dropped} stale entries · ${kept.length} kept`)
