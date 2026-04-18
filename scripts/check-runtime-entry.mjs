import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(new URL('..', import.meta.url).pathname)
const mainPath = resolve(repoRoot, 'src/main.jsx')
const routeAppPath = resolve(repoRoot, 'src/App.routes.jsx')
const routeLayoutPath = resolve(repoRoot, 'src/pages/PortfolioLayout.jsx')
const quickStartPath = resolve(repoRoot, 'docs/QUICK_START.md')
const systemAnalysisPath = resolve(repoRoot, 'docs/specs/2026-04-18-portfolio-dashboard-sa.md')

const mainSource = readFileSync(mainPath, 'utf8')
const routeAppSource = readFileSync(routeAppPath, 'utf8')
const routeLayoutSource = readFileSync(routeLayoutPath, 'utf8')
const quickStartSource = readFileSync(quickStartPath, 'utf8')
const systemAnalysisSource = readFileSync(systemAnalysisPath, 'utf8')

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

if (
  !routeAppSource.includes('This file is not the current production runtime entry.') ||
  !routeAppSource.includes('The stable runtime remains `src/main.jsx -> src/App.jsx`.')
) {
  console.error(
    '[check-runtime-entry] src/App.routes.jsx lost its migration-only warning about the stable runtime.'
  )
  process.exit(1)
}

if (
  !systemAnalysisSource.includes('`src/main.jsx -> src/App.jsx`') ||
  !systemAnalysisSource.includes('route shell 是 migration line')
) {
  console.error(
    '[check-runtime-entry] system analysis drifted away from the current truth about App.routes.jsx.'
  )
  process.exit(1)
}

const hasRouteShellMarker = routeLayoutSource.includes("'data-route-shell': 'true'")
const hasRouteShellScopeMarker = routeLayoutSource.includes("'data-route-shell-limited': 'true'")
const hasRouteShellWarning =
  routeLayoutSource.includes('路由頁面仍屬遷移殼層') &&
  (routeLayoutSource.includes('不會同步回主 AppShell') ||
    routeLayoutSource.includes('正式 runtime 仍以主 AppShell 為準。'))

if (!hasRouteShellMarker || !hasRouteShellScopeMarker || !hasRouteShellWarning) {
  console.error(
    '[check-runtime-entry] route portfolio layout lost its migration-shell marker or warning.'
  )
  process.exit(1)
}

console.log('[check-runtime-entry] OK: src/main.jsx -> src/App.jsx remains canonical.')
