import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

let hasLoadedLocalEnv = false

function parseEnvLine(line) {
  const trimmed = String(line || '').trim()
  if (!trimmed || trimmed.startsWith('#')) return null

  const separatorIndex = trimmed.indexOf('=')
  if (separatorIndex <= 0) return null

  const key = trimmed.slice(0, separatorIndex).trim()
  const rawValue = trimmed.slice(separatorIndex + 1).trim()
  const value = rawValue.replace(/^['"]|['"]$/g, '')

  return key ? { key, value } : null
}

export function loadLocalEnvIfPresent({ cwd = process.cwd(), filename = '.env.local' } = {}) {
  if (hasLoadedLocalEnv) return
  hasLoadedLocalEnv = true

  if (process.env.VERCEL || process.env.VERCEL_ENV === 'production' || process.env.VITEST) return

  const envPath = resolve(cwd, filename)
  if (!existsSync(envPath)) return

  const content = readFileSync(envPath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line)
    if (!parsed || process.env[parsed.key]) continue
    process.env[parsed.key] = parsed.value
  }
}
