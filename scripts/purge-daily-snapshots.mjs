import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadLocalEnvIfPresent } from '../api/_lib/local-env.js'
import { purgeExpiredDailySnapshots } from '../agent-bridge-standalone/workers/snapshot-worker.mjs'

function resolveRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
}

function parseArgs(argv = []) {
  return {
    dryRun: argv.includes('--dry-run'),
  }
}

async function main() {
  const repoRoot = resolveRepoRoot()
  loadLocalEnvIfPresent({ cwd: repoRoot })
  const args = parseArgs(process.argv.slice(2))
  const result = await purgeExpiredDailySnapshots({
    now: new Date(),
    dryRun: args.dryRun,
    logger: console,
  })
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error('[purge-daily-snapshots] failed:', error)
  process.exitCode = 1
})
