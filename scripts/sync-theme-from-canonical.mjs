import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..')

export const CANONICAL_TOKENS_PATH = path.join(
  ROOT_DIR,
  'docs',
  'portfolio-spec-report',
  'tokens.css'
)
export const GENERATED_THEME_PATH = path.join(ROOT_DIR, 'src', 'theme.generated.js')
export const GENERATED_CHECKSUM_PATH = path.join(ROOT_DIR, 'src', 'theme.generated.checksum')

const GENERATED_HEADER = [
  '// AUTO-GENERATED from docs/portfolio-spec-report/tokens.css',
  "// DO NOT EDIT · run `npm run theme:sync` to update",
]
const DOC_ONLY_ALIAS_KEYS = new Set(['sage', 'sageSoft'])

function stripCssComments(cssText) {
  return cssText.replace(/\/\*[\s\S]*?\*\//g, '')
}

function extractRootBlock(cssText) {
  const matched = cssText.match(/:root\s*\{([\s\S]*?)\}/)
  if (!matched) {
    throw new Error('Unable to locate :root block in canonical tokens.css')
  }

  return matched[1]
}

function normalizeValue(value) {
  return value.trim().replace(/\s+/g, ' ')
}

export function kebabToCamel(name) {
  return name.replace(/-([a-z0-9])/gi, (_, letter) => letter.toUpperCase())
}

export function parseCanonicalTokens(cssText) {
  const rootBlock = extractRootBlock(stripCssComments(cssText))
  const entries = []
  const indexByKey = new Map()
  const declarationPattern = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi

  for (const match of rootBlock.matchAll(declarationPattern)) {
    const key = kebabToCamel(match[1])
    const value = normalizeValue(match[2])

    if (DOC_ONLY_ALIAS_KEYS.has(key)) continue

    if (indexByKey.has(key)) {
      entries[indexByKey.get(key)] = [key, value]
      continue
    }

    indexByKey.set(key, entries.length)
    entries.push([key, value])
  }

  return entries
}

export function buildGeneratedThemeSource(tokenEntries) {
  const lines = [...GENERATED_HEADER, 'export const TOKENS = Object.freeze({']

  for (const [key, value] of tokenEntries) {
    lines.push(`  ${key}: ${serializeJsString(value)},`)
  }

  lines.push('})', '')
  return lines.join('\n')
}

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

function serializeJsString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

export function buildThemeArtifactsFromCss(cssText) {
  const tokenEntries = parseCanonicalTokens(cssText)
  return {
    tokenEntries,
    tokens: Object.fromEntries(tokenEntries),
    moduleSource: buildGeneratedThemeSource(tokenEntries),
    checksum: sha256(cssText),
  }
}

async function readIfExists(filePath) {
  try {
    return await readFile(filePath, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

export async function syncThemeArtifacts({
  canonicalPath = CANONICAL_TOKENS_PATH,
  generatedPath = GENERATED_THEME_PATH,
  checksumPath = GENERATED_CHECKSUM_PATH,
  check = false,
} = {}) {
  const cssText = await readFile(canonicalPath, 'utf8')
  const artifacts = buildThemeArtifactsFromCss(cssText)

  if (check) {
    const currentGenerated = await readIfExists(generatedPath)
    const currentChecksum = await readIfExists(checksumPath)
    const drift = []

    if (currentGenerated !== artifacts.moduleSource) {
      drift.push(path.relative(ROOT_DIR, generatedPath))
    }

    if ((currentChecksum || '').trim() !== artifacts.checksum) {
      drift.push(path.relative(ROOT_DIR, checksumPath))
    }

    return { ...artifacts, drift }
  }

  await mkdir(path.dirname(generatedPath), { recursive: true })
  await writeFile(generatedPath, artifacts.moduleSource, 'utf8')
  await writeFile(checksumPath, `${artifacts.checksum}\n`, 'utf8')

  return { ...artifacts, drift: [] }
}

async function main() {
  const check = process.argv.includes('--check')
  const result = await syncThemeArtifacts({ check })

  if (result.drift.length > 0) {
    console.error('theme drift detected:')
    for (const filePath of result.drift) {
      console.error(`- ${filePath}`)
    }
    console.error('Run: npm run theme:sync')
    process.exitCode = 1
    return
  }

  if (check) {
    console.log('theme artifacts are in sync')
    return
  }

  console.log(
    `synced ${result.tokenEntries.length} theme tokens from docs/portfolio-spec-report/tokens.css`
  )
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
