import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const sourceFilePattern = /\.(?:jsx?|mjs)$/
const excludedFilePattern = /(^|\/)theme(?:\.generated)?\.js$/
const excludedFiles = new Set(['scripts/check-facade-alias.mjs'])
const facadeAliasPattern = /\bC\.(blue|olive|teal|cyan|fillPrimary|blueBg|oliveBg|tealBg)\b/g
const exceptionPattern = /\/\/\s*facade-alias-exception\s*:/
const mainlineCandidates = ['origin/main', 'origin/master', 'main', 'master']

function runGit(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trimEnd()
  } catch (error) {
    if (allowFailure) return null
    const stderr = error.stderr?.toString().trim()
    const detail = stderr ? `\n${stderr}` : ''
    console.error(`[check-facade-alias] git ${args.join(' ')} failed.${detail}`)
    process.exit(1)
  }
}

function splitLines(value) {
  if (!value) return []
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function filterSourceFiles(files) {
  return Array.from(
    new Set(
      files.filter(
        (file) =>
          sourceFilePattern.test(file) &&
          !excludedFilePattern.test(file) &&
          !excludedFiles.has(file)
      )
    )
  ).sort()
}

function detectBaseRef() {
  for (const candidate of mainlineCandidates) {
    if (runGit(['rev-parse', '--verify', candidate], { allowFailure: true })) {
      return candidate
    }
  }

  return null
}

function collectFiles(mode, baseRef) {
  if (mode === 'staged') {
    return filterSourceFiles(
      splitLines(runGit(['diff', '--cached', '--name-only', '--diff-filter=ACM', '--']))
    )
  }

  if (mode === 'unstaged') {
    return filterSourceFiles(splitLines(runGit(['diff', '--name-only', '--diff-filter=ACM', '--'])))
  }

  if (mode === 'untracked') {
    return filterSourceFiles(
      splitLines(runGit(['ls-files', '--others', '--exclude-standard', '--']))
    )
  }

  if (mode === 'base') {
    return filterSourceFiles(
      splitLines(runGit(['diff', '--name-only', '--diff-filter=ACM', `${baseRef}...HEAD`, '--']))
    )
  }

  console.error(`[check-facade-alias] unsupported mode: ${mode}`)
  process.exit(1)
}

function parseAddedDiffLines(file, diffText) {
  const violations = []
  let lineNumber = 0

  for (const rawLine of diffText.split('\n')) {
    const hunkMatch = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(rawLine)
    if (hunkMatch) {
      lineNumber = Number(hunkMatch[1])
      continue
    }

    if (!rawLine) continue
    if (
      rawLine.startsWith('+++') ||
      rawLine.startsWith('diff --git') ||
      rawLine.startsWith('index ')
    ) {
      continue
    }
    if (rawLine.startsWith('\\')) continue

    if (rawLine.startsWith('+')) {
      const addedLine = rawLine.slice(1)
      const trimmed = addedLine.trimStart()

      if (!exceptionPattern.test(addedLine)) {
        if (!trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')) {
          facadeAliasPattern.lastIndex = 0
          for (const match of addedLine.matchAll(facadeAliasPattern)) {
            violations.push({
              file,
              lineNumber,
              alias: match[0],
            })
          }
        }
      }

      lineNumber += 1
      continue
    }

    if (rawLine.startsWith(' ')) {
      lineNumber += 1
    }
  }

  return violations
}

function collectDiffViolations(mode, files, baseRef) {
  const violations = []

  for (const file of files) {
    let diffText = ''

    if (mode === 'staged') {
      diffText = runGit(['diff', '--cached', '--unified=0', '--no-color', '--', file])
    } else if (mode === 'unstaged') {
      diffText = runGit(['diff', '--unified=0', '--no-color', '--', file])
    } else if (mode === 'base') {
      diffText = runGit(['diff', '--unified=0', '--no-color', `${baseRef}...HEAD`, '--', file])
    } else {
      console.error(`[check-facade-alias] unsupported diff mode: ${mode}`)
      process.exit(1)
    }

    violations.push(...parseAddedDiffLines(file, diffText))
  }

  return violations
}

function collectUntrackedViolations(files) {
  const violations = []

  for (const file of files) {
    const filePath = path.resolve(repoRoot, file)
    const lines = readFileSync(filePath, 'utf8').split('\n')

    lines.forEach((line, index) => {
      const trimmed = line.trimStart()
      if (exceptionPattern.test(line)) return
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return

      facadeAliasPattern.lastIndex = 0
      for (const match of line.matchAll(facadeAliasPattern)) {
        violations.push({
          file,
          lineNumber: index + 1,
          alias: match[0],
        })
      }
    })
  }

  return violations
}

function dedupeViolations(violations) {
  return Array.from(
    new Map(
      violations.map((violation) => [
        `${violation.file}:${violation.lineNumber}:${violation.alias}`,
        violation,
      ])
    ).values()
  ).sort((left, right) => {
    const fileCompare = left.file.localeCompare(right.file)
    if (fileCompare !== 0) return fileCompare
    if (left.lineNumber !== right.lineNumber) return left.lineNumber - right.lineNumber
    return left.alias.localeCompare(right.alias)
  })
}

function parseArgs(argv) {
  let mode = 'auto'
  let baseRef = null

  for (const arg of argv) {
    if (arg === '--staged') {
      if (mode !== 'auto') {
        console.error('[check-facade-alias] use only one explicit diff mode.')
        process.exit(1)
      }
      mode = 'staged'
      continue
    }

    if (arg.startsWith('--diff-base=')) {
      if (mode !== 'auto') {
        console.error('[check-facade-alias] use only one explicit diff mode.')
        process.exit(1)
      }
      mode = 'base'
      baseRef = arg.slice('--diff-base='.length)
      if (!baseRef) {
        console.error('[check-facade-alias] --diff-base requires a git ref.')
        process.exit(1)
      }
      continue
    }

    console.error(`[check-facade-alias] unknown argument: ${arg}`)
    process.exit(1)
  }

  return { mode, baseRef }
}

function formatScopeLabel(scopes) {
  return scopes.join(', ')
}

function shouldInspectCommittedBranchDiff() {
  return process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
}

const { mode, baseRef: explicitBaseRef } = parseArgs(process.argv.slice(2))
const scopes = []
const violations = []

if (mode === 'staged') {
  const stagedFiles = collectFiles('staged')
  if (stagedFiles.length > 0) {
    scopes.push('staged diff')
    violations.push(...collectDiffViolations('staged', stagedFiles))
  }
} else if (mode === 'base') {
  const baseRef = explicitBaseRef
  const baseFiles = collectFiles('base', baseRef)
  if (baseFiles.length > 0) {
    scopes.push(`${baseRef}...HEAD`)
    violations.push(...collectDiffViolations('base', baseFiles, baseRef))
  }
} else {
  const stagedFiles = collectFiles('staged')
  if (stagedFiles.length > 0) {
    scopes.push('staged diff')
    violations.push(...collectDiffViolations('staged', stagedFiles))
  }

  const unstagedFiles = collectFiles('unstaged')
  if (unstagedFiles.length > 0) {
    scopes.push('unstaged diff')
    violations.push(...collectDiffViolations('unstaged', unstagedFiles))
  }

  const untrackedFiles = collectFiles('untracked')
  if (untrackedFiles.length > 0) {
    scopes.push('untracked source files')
    violations.push(...collectUntrackedViolations(untrackedFiles))
  }

  if (shouldInspectCommittedBranchDiff()) {
    const detectedBaseRef = detectBaseRef()
    if (detectedBaseRef) {
      const baseFiles = collectFiles('base', detectedBaseRef)
      if (baseFiles.length > 0) {
        scopes.push(`${detectedBaseRef}...HEAD`)
        violations.push(...collectDiffViolations('base', baseFiles, detectedBaseRef))
      }
    }
  }
}

const uniqueViolations = dedupeViolations(violations)

if (uniqueViolations.length > 0) {
  console.error('❌ Facade alias use detected:')
  uniqueViolations.forEach((violation) => {
    console.error(`  ${violation.file}:${violation.lineNumber}   ${violation.alias}`)
  })
  console.error('')
  console.error(
    'Facade aliases (C.blue/C.olive/C.teal/C.cyan/C.fillPrimary/C.blueBg/C.oliveBg/C.tealBg) are frozen per C1a'
  )
  console.error(
    '(docs/decisions/2026-04-24-facade-alias-freeze.md; extends R139 Round 2 Q5 and docs/decisions/2026-04-24-r120-scope-batch.md).'
  )
  console.error(
    'Use canonical semantics backed by src/theme.generated.js instead (for example: C.up/C.down/C.amber/C.orange or TOKENS.positive/warning/cta/hot).'
  )
  console.error(
    'If you MUST use a facade for legacy-consistency reason, add `// facade-alias-exception: reason` on the same line.'
  )
  process.exit(1)
}

if (scopes.length === 0) {
  console.log('[check-facade-alias] OK: no matching source changes to inspect.')
} else {
  console.log(
    `[check-facade-alias] OK: no new frozen facade alias consumers found in ${formatScopeLabel(scopes)}.`
  )
}
