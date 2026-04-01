import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const currentWorkPath = path.join(rootDir, 'docs/status/current-work.md')
const aiActivityPath = path.join(rootDir, 'docs/status/ai-activity.json')
const aiActivityLogPath = path.join(rootDir, 'docs/status/ai-activity-log.json')
const statePath = path.join(rootDir, 'docs-site/state.json')
const appPath = path.join(rootDir, 'src/App.jsx')
const testsPath = path.join(rootDir, 'tests')
const docsPath = path.join(rootDir, 'docs')
const vscodeExtensionsPath = path.join(rootDir, '.vscode/extensions.json')
const launchQwenPath = path.join(rootDir, 'scripts/launch-qwen.sh')
const launchGeminiPath = path.join(rootDir, 'scripts/launch-gemini.sh')
const launchGeminiScoutPath = path.join(rootDir, 'scripts/launch-gemini-research-scout.sh')
const aiStatusPath = path.join(rootDir, 'scripts/ai-status.sh')
const aiProgressReporterPath = path.join(rootDir, 'scripts/report-ai-progress.py')
const aiActivityMirrorPath = path.join(rootDir, 'docs-site/ai-activity.json')
const aiActivityLogMirrorPath = path.join(rootDir, 'docs-site/ai-activity-log.json')

const fullHealth = process.argv.includes('--full')

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function readJson(filePath) {
  return JSON.parse(readText(filePath))
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null
  return readJson(filePath)
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function countFiles(dirPath, predicate) {
  if (!fs.existsSync(dirPath)) return 0

  let count = 0
  const queue = [dirPath]

  while (queue.length) {
    const current = queue.pop()
    const entries = fs.readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        queue.push(fullPath)
      } else if (predicate(fullPath)) {
        count += 1
      }
    }
  }

  return count
}

function countTestDefinitions(dirPath) {
  if (!fs.existsSync(dirPath)) return 0

  let count = 0
  const queue = [dirPath]

  while (queue.length) {
    const current = queue.pop()
    const entries = fs.readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        queue.push(fullPath)
        continue
      }

      if (!/\.test\.(js|jsx|ts|tsx)$/.test(fullPath)) continue
      const text = readText(fullPath)
      const matches = text.match(/\b(?:test|it)\s*\(/g)
      count += matches ? matches.length : 0
    }
  }

  return count
}

function extractSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = markdown.match(new RegExp(`^## ${escaped}\\n([\\s\\S]*?)(?=^##\\s|\\Z)`, 'm'))
  return match ? match[1].trim() : ''
}

function stripMarkdown(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function shorten(text, maxLength = 96) {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1).trim()}…`
}

function parseCurrentWork(markdown) {
  const lastUpdated = markdown.match(/^Last updated:\s*(.+)$/m)?.[1]?.trim() || ''
  const objective = stripMarkdown(extractSection(markdown, 'Objective').split('\n')[0] || '')
  const checkpointSection = extractSection(markdown, 'Latest checkpoint')

  const checkpoints = []
  const checkpointRegex = /^- `([^`]+)`\s+([^：:]+)[：:]\s*(.+)$/gm
  for (const match of checkpointSection.matchAll(checkpointRegex)) {
    checkpoints.push({
      time: match[1].trim(),
      ai: match[2].trim(),
      message: stripMarkdown(match[3].trim()),
    })
  }

  return {
    lastUpdated,
    objective,
    checkpoints,
  }
}

function toIsoTaipei(raw) {
  if (!raw) return new Date().toISOString()
  if (raw.includes('T')) return raw
  return `${raw.replace(' ', 'T')}:00+08:00`
}

function pickLatestIso(...values) {
  const candidates = values.filter(Boolean).map((value) => new Date(value).getTime()).filter((value) => Number.isFinite(value))
  if (!candidates.length) return new Date().toISOString()
  return new Date(Math.max(...candidates)).toISOString()
}

function pickLatestTestSummary(checkpoints) {
  for (const checkpoint of checkpoints) {
    const match = checkpoint.message.match(/(\d+)\s+files?\s*\/\s*(\d+)\s+tests?/i)
    if (match) {
      return {
        files: Number(match[1]),
        tests: Number(match[2]),
      }
    }
  }
  return null
}

function buildTimeline(checkpoints) {
  return checkpoints.slice(0, 8).map((checkpoint) => {
    let impact = '詳見 docs/status/current-work.md'
    if (/verify:local|build|healthcheck|smoke:ui/i.test(checkpoint.message)) {
      impact = '驗證鏈狀態已更新'
    } else if (/App\.jsx|AppShellFrame|useAppRuntime/.test(checkpoint.message)) {
      impact = '主 runtime 邊界持續收斂'
    } else if (/docs-site|state\.json|sync-state/i.test(checkpoint.message)) {
      impact = '儀表板狀態同步已更新'
    }

    return {
      time: checkpoint.time,
      ai: checkpoint.ai,
      title: shorten(checkpoint.message, 120),
      description: '同步自 docs/status/current-work.md',
      impact,
      status: 'done',
    }
  })
}

function runCommand(command) {
  try {
    execSync(command, {
      cwd: rootDir,
      stdio: 'ignore',
      env: process.env,
    })
    return 'passing'
  } catch {
    return 'failing'
  }
}

function commandExists(command) {
  try {
    execSync(command, {
      cwd: rootDir,
      stdio: 'ignore',
      env: process.env,
    })
    return true
  } catch {
    return false
  }
}

const currentWork = parseCurrentWork(readText(currentWorkPath))
const baseState = readJson(statePath)
const aiActivity = readJsonIfExists(aiActivityPath)
const aiActivityLog = readJsonIfExists(aiActivityLogPath)
const appJsxLines = readText(appPath).trimEnd().split('\n').length
const testFiles = countFiles(testsPath, (filePath) => /\.test\.(js|jsx|ts|tsx)$/.test(filePath))
const docsCount = countFiles(docsPath, (filePath) => filePath.endsWith('.md'))
const latestTestSummary = pickLatestTestSummary(currentWork.checkpoints)
const testCases = latestTestSummary?.tests ?? countTestDefinitions(testsPath)
const canonicalIsoTime = toIsoTaipei(currentWork.lastUpdated)
const activityIsoTime = aiActivity?.lastUpdated || null
const todayDate = currentWork.lastUpdated.slice(0, 10)
const todayCheckpointCount = currentWork.checkpoints.filter((checkpoint) => checkpoint.time.startsWith(todayDate)).length
const previousAppLines = Number(baseState.metrics?.appJsxLines || 0)
const appLineDelta = previousAppLines ? appJsxLines - previousAppLines : 0

const health = {
  ...(baseState.health || {}),
}

if (fullHealth) {
  health.build = runCommand('npm run build')
  health.lint = runCommand('npm run lint')
  health.tests = runCommand('npm run test:run')
}

const healthStates = [health.build, health.lint, health.tests].filter(Boolean)
health.overall = healthStates.every((status) => status === 'passing') ? 'healthy' : 'warning'

const latestCheckpoint = currentWork.checkpoints[0]
const aiMembers = aiActivity?.members || baseState.aiTeam?.members || []
const workingMembers = aiMembers.filter((member) => member.status === 'working')
const currentAi = aiActivity?.current || workingMembers[0]?.name || latestCheckpoint?.ai || baseState.aiTeam?.current || 'Codex'
const topHighlights = [
  `✅ App.jsx 已收斂為 ${appJsxLines} 行薄入口`,
  latestTestSummary
    ? `✅ 最新完整基線 ${latestTestSummary.files} files / ${latestTestSummary.tests} tests`
    : `✅ 目前測試檔 ${testFiles} 個`,
  '🔄 docs-site 狀態改由 current-work.md 單一真相生成',
]

const nextStep = currentWork.objective || baseState.handover?.nextStep || '持續維持主 runtime 與文件真相一致'
const vscodeRecommendations = readJsonIfExists(vscodeExtensionsPath)?.recommendations || []
const launcherQwenText = fs.existsSync(launchQwenPath) ? readText(launchQwenPath) : ''
const launcherGeminiText = fs.existsSync(launchGeminiPath) ? readText(launchGeminiPath) : ''
const launcherGeminiScoutText = fs.existsSync(launchGeminiScoutPath) ? readText(launchGeminiScoutPath) : ''
const blamepromptCliInstalled = commandExists('command -v blameprompt >/dev/null 2>&1 || test -x "$HOME/.local/bin/blameprompt"')

const trackingStack = {
  gitlensRecommended: vscodeRecommendations.includes('eamodio.gitlens'),
  blamepromptRecommended: vscodeRecommendations.includes('blameprompt.blameprompt'),
  blamepromptCliInstalled,
  aiStatusPipelineReady: fs.existsSync(aiStatusPath) && fs.existsSync(aiProgressReporterPath),
  launcherAutoReportReady:
    launcherQwenText.includes('scripts/ai-status.sh') &&
    launcherGeminiText.includes('scripts/ai-status.sh') &&
    launcherGeminiScoutText.includes('scripts/ai-status.sh'),
  liveActivityMirrorReady: fs.existsSync(aiActivityMirrorPath) && fs.existsSync(aiActivityLogMirrorPath),
}

const nextState = {
  ...baseState,
  lastUpdated: pickLatestIso(canonicalIsoTime, activityIsoTime),
  generatedAt: new Date().toISOString(),
  sources: {
    canonicalStatus: 'docs/status/current-work.md',
    canonicalAiActivity: 'docs/status/ai-activity.json',
    generatedView: 'docs-site/state.json',
    generator: 'scripts/build-docs-state.mjs',
  },
  summary: {
    ...baseState.summary,
    today: `今天新增 ${todayCheckpointCount} 個 checkpoint，App.jsx 已是 ${appJsxLines} 行薄入口`,
    thisWeek: latestTestSummary
      ? `本週主線維持主 runtime 收斂；最新已知綠燈基線 ${latestTestSummary.files} files / ${latestTestSummary.tests} tests`
      : '本週主線維持主 runtime 收斂與驗證鏈綠燈',
    highlights: topHighlights,
  },
  metrics: {
    ...baseState.metrics,
    appJsxLines,
    appJsxLinesChange: appLineDelta,
    testFiles,
    testCases,
    totalDocs: docsCount,
    inProgressTasks: workingMembers.length,
  },
  health,
  trackingStack,
  liveActivity: aiActivityLog?.entries?.slice(0, 10) || [],
  timeline: buildTimeline(currentWork.checkpoints),
  handover: {
    ...baseState.handover,
    from: latestCheckpoint?.ai || baseState.handover?.from || 'Codex',
    time: latestCheckpoint ? toIsoTaipei(latestCheckpoint.time) : canonicalIsoTime,
    message: latestCheckpoint?.message || baseState.handover?.message || '',
    nextStep,
    blockers: [],
    needsReview: false,
    optimizationSuggestions: [
      '每次更新 docs/status/current-work.md 後執行 bash scripts/sync-state.sh',
      '若需要重刷 build/lint/test 健康狀態，再執行 bash scripts/sync-state.sh --full',
    ],
  },
  aiTeam: {
    ...baseState.aiTeam,
    current: currentAi,
    members: aiMembers,
  },
}

writeJson(statePath, nextState)

console.log(`✅ docs-site/state.json 已從 docs/status/current-work.md 重新生成`)
console.log(`   App.jsx 行數：${appJsxLines}`)
console.log(`   測試：${testFiles} files / ${testCases} tests`)
console.log(`   狀態時間：${currentWork.lastUpdated || 'unknown'}`)
