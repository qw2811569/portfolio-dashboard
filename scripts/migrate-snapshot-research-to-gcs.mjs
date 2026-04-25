import process from 'node:process'
import { pathToFileURL } from 'node:url'

import {
  loadKeyInventory as loadGenericKeyInventory,
  main as runGenericMain,
  resolveDefaultPathsForKeyspace,
  runMigration as runGenericMigration,
} from './migrate-prefix-keyspace-to-gcs.mjs'

const SNAPSHOT_RESEARCH_KEYSPACE = 'snapshot.research'
const defaults = resolveDefaultPathsForKeyspace(SNAPSHOT_RESEARCH_KEYSPACE)

export const DEFAULT_STATE_PATH = defaults.statePath
export const DEFAULT_REVERSE_MANIFEST_PATH = defaults.reverseManifestPath
export const DEFAULT_LOCK_PATH = defaults.lockPath

export async function loadKeyInventory(options = {}) {
  return loadGenericKeyInventory({
    keyspace: SNAPSHOT_RESEARCH_KEYSPACE,
    ...options,
  })
}

export async function runMigration(options = {}, deps = {}) {
  return runGenericMigration(
    {
      keyspace: SNAPSHOT_RESEARCH_KEYSPACE,
      ...options,
    },
    deps
  )
}

export async function main(argv = process.argv.slice(2), deps = {}) {
  const nextArgv = argv.some((arg) => String(arg || '').startsWith('--keyspace='))
    ? argv
    : [`--keyspace=${SNAPSHOT_RESEARCH_KEYSPACE}`, ...argv]
  return runGenericMain(nextArgv, deps)
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((error) => {
    console.error('[migrate-snapshot-research-to-gcs] failed:', error?.message || error)
    process.exitCode = 1
  })
}
