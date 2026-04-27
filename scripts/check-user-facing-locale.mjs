#!/usr/bin/env node

/**
 * User-facing locale lint.
 *
 * What this catches:
 * - Author-controlled JSX text, common accessibility/copy props, selected label keys, and
 *   `h(..., 'text')` children under `src/` that expose Latin jargon to users.
 *
 * What it does not catch:
 * - AI-generated markdown, remote API copy, user-entered content, or runtime-composed rich text.
 *   Those need prompt/runtime sanitizers and e2e text snapshots.
 *
 * How to add a temporary allowlist entry:
 * - Add `{ "file": "src/...", "text": "Exact text", "reason": "why temporary" }` to
 *   `.locale-known-fails.json`. Prefer exact file+text entries; omit `file` only when the source is
 *   intentionally being located by the next sweep.
 *
 * How to fix a fail:
 * - Replace the user-facing English/jargon with concise Chinese, or move the value out of a
 *   user-facing component/page into an internal lib/test path if it is not UI copy.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const SRC_DIR = path.join(ROOT, 'src')
const KNOWN_FAILS_PATH = path.join(ROOT, '.locale-known-fails.json')

const USER_FACING_PROP_NAMES = new Set([
  'aria-label',
  'title',
  'placeholder',
  'routeLabel',
  'filterLabel',
  'eyebrow',
  'eventTypeLabel',
])
const USER_FACING_OBJECT_KEYS = new Set(['routeLabel', 'filterLabel', 'eyebrow', 'eventTypeLabel'])
const INTERNAL_PATH_RE = /(^|\/)(tests?|lib|hooks|data|constants)(\/|$)/u
const COMPONENT_PATH_RE = /(^|\/)(components|pages)(\/|$)/u

const ALLOWED_WORDS = new Set([
  'FinMind',
  'MOPS',
  'TWSE',
  'OTC',
  'OTCB',
  'Markdown',
  'PDF',
  'AI',
  'Google',
  'Gemini',
  'FactSet',
  'CMoney',
  'EPS',
  'HHI',
])

const VERSION_RE = /^v?\d+(?:\.\d+){1,3}$/iu
const ROUND_RE = /^R\d+[a-z]?$/iu
const STOCK_RE = /^\d{4}$/u
const LATIN_RE = /[A-Za-z][A-Za-z0-9+-]{2,}/gu
const STAGE_RE = /\bT[01]\b/gu

function toPosix(filePath) {
  return filePath.split(path.sep).join('/')
}

function readKnownFails() {
  if (!existsSync(KNOWN_FAILS_PATH)) return []
  return JSON.parse(readFileSync(KNOWN_FAILS_PATH, 'utf8'))
}

function listSourceFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) return listSourceFiles(absolute)
    if (/\.(jsx?|tsx?)$/u.test(entry.name)) return [absolute]
    return []
  })
}

function getNodeText(node) {
  if (ts.isStringLiteralLike(node)) return node.text
  if (ts.isJsxText(node)) return node.getText().replace(/\s+/g, ' ').trim()
  return ''
}

function getNameText(name) {
  if (!name) return ''
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text
  return name.getText()
}

function isAllowedToken(token) {
  if (ALLOWED_WORDS.has(token)) return true
  if (VERSION_RE.test(token) || ROUND_RE.test(token) || STOCK_RE.test(token)) return true
  if (/^[A-Z]{1,2}$/u.test(token)) return true
  return false
}

function findBlockedTokens(text, file) {
  const tokens = []
  const normalized = String(text || '')

  for (const match of normalized.matchAll(LATIN_RE)) {
    const token = match[0]
    if (!isAllowedToken(token)) tokens.push(token)
  }

  if (COMPONENT_PATH_RE.test(file) && !INTERNAL_PATH_RE.test(file)) {
    for (const match of normalized.matchAll(STAGE_RE)) {
      tokens.push(match[0])
    }
  }

  return [...new Set(tokens)]
}

function isKnownFail(finding, knownFails) {
  return knownFails.some((entry) => {
    if (entry.file && entry.file !== finding.file) return false
    return String(finding.text).includes(entry.text)
  })
}

function addFinding(findings, sourceFile, file, node, text, surface) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return
  const tokens = findBlockedTokens(normalized, file)
  if (tokens.length === 0) return
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
  findings.push({
    file,
    line: line + 1,
    column: character + 1,
    surface,
    text: normalized,
    tokens,
  })
}

function scanFile(absolutePath) {
  const file = toPosix(path.relative(ROOT, absolutePath))
  const source = readFileSync(absolutePath, 'utf8')
  const sourceFile = ts.createSourceFile(
    absolutePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    absolutePath.endsWith('.tsx') || absolutePath.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const findings = []

  function visit(node) {
    if (ts.isJsxText(node)) {
      addFinding(findings, sourceFile, file, node, getNodeText(node), 'jsx-text')
    }

    if (ts.isJsxAttribute(node) && USER_FACING_PROP_NAMES.has(getNameText(node.name))) {
      const initializer = node.initializer
      if (initializer && ts.isStringLiteral(initializer)) {
        addFinding(findings, sourceFile, file, initializer, initializer.text, `prop:${getNameText(node.name)}`)
      }
    }

    if (ts.isPropertyAssignment(node) && USER_FACING_OBJECT_KEYS.has(getNameText(node.name))) {
      if (ts.isStringLiteralLike(node.initializer)) {
        addFinding(
          findings,
          sourceFile,
          file,
          node.initializer,
          node.initializer.text,
          `key:${getNameText(node.name)}`
        )
      }
    }

    if (ts.isCallExpression(node) && ['h', 'createElement'].includes(node.expression.getText(sourceFile))) {
      const elementName = node.arguments[0]
      if (ts.isStringLiteralLike(elementName) && elementName.text === 'style') {
        ts.forEachChild(node, visit)
        return
      }
      node.arguments.slice(2).forEach((argument) => {
        if (ts.isStringLiteralLike(argument)) {
          addFinding(findings, sourceFile, file, argument, argument.text, 'createElement-child')
        } else if (ts.isTemplateExpression(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
          // Cover template literals: scan head + middle parts for blocked tokens
          const head = argument.head?.text || argument.text || ''
          const middles = (argument.templateSpans || []).map((s) => s.literal?.text || '').join(' ')
          const combined = `${head} ${middles}`.trim()
          if (combined) {
            addFinding(findings, sourceFile, file, argument, combined, 'createElement-template')
          }
        }
      })
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return findings
}

const knownFails = readKnownFails()
const findings = listSourceFiles(SRC_DIR).flatMap(scanFile)
const unexpected = findings.filter((finding) => !isKnownFail(finding, knownFails))

if (unexpected.length > 0) {
  console.error(`user-facing locale lint failed: ${unexpected.length} unexpected finding(s)`)
  unexpected.slice(0, 80).forEach((finding) => {
    console.error(
      `${finding.file}:${finding.line}:${finding.column} ${finding.surface} [${finding.tokens.join(', ')}] ${JSON.stringify(finding.text)}`
    )
  })
  if (unexpected.length > 80) console.error(`...and ${unexpected.length - 80} more`)
  process.exit(1)
}

console.log(
  `user-facing locale lint passed (${findings.length} finding(s), ${findings.length - unexpected.length} known baseline)`
)
