import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(new URL('..', import.meta.url).pathname)
const mainPath = resolve(repoRoot, 'src/main.jsx')
const quickStartPath = resolve(repoRoot, 'docs/QUICK_START.md')

const mainSource = readFileSync(mainPath, 'utf8')
const quickStartSource = readFileSync(quickStartPath, 'utf8')

if (!/import\s+App\s+from\s+['"]\.\/App\.jsx['"]/.test(mainSource)) {
  console.error('[check-runtime-entry] src/main.jsx no longer imports ./App.jsx as the app entry.')
  process.exit(1)
}

if (/App\.routes\.jsx|['"]\.\/App\.routes\.jsx['"]/.test(mainSource)) {
  console.error(
    '[check-runtime-entry] src/main.jsx points at App.routes.jsx. Route shell is still migration-only.'
  )
  process.exit(1)
}

if (!quickStartSource.includes('src/main.jsx -> src/App.jsx')) {
  console.error(
    '[check-runtime-entry] docs/QUICK_START.md drifted away from the canonical runtime entry.'
  )
  process.exit(1)
}

console.log('[check-runtime-entry] OK: src/main.jsx -> src/App.jsx remains canonical.')
