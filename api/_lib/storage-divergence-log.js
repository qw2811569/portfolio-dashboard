import { appendFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_DIVERGENCE_LOG_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'logs'
)

export function bufferToUtf8(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (Buffer.isBuffer(value)) return value.toString('utf8')
  if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8')
  return String(value)
}

export function stableJsonStringify(value) {
  return JSON.stringify(sortJsonValue(value))
}

function sortJsonValue(value) {
  if (Array.isArray(value)) return value.map(sortJsonValue)
  if (!value || typeof value !== 'object') return value

  return Object.keys(value)
    .sort((left, right) => left.localeCompare(right))
    .reduce((accumulator, key) => {
      accumulator[key] = sortJsonValue(value[key])
      return accumulator
    }, {})
}

export function sha256(value) {
  return createHash('sha256')
    .update(String(value || ''), 'utf8')
    .digest('hex')
}

export function defaultScheduleBackgroundTask(task) {
  const runner = () => {
    void Promise.resolve().then(task)
  }

  if (typeof setImmediate === 'function') {
    setImmediate(runner)
    return
  }

  if (typeof queueMicrotask === 'function') {
    queueMicrotask(runner)
    return
  }

  setTimeout(runner, 0)
}

export async function appendStorageDivergenceMetric(
  record,
  {
    now = new Date(),
    logDir = DEFAULT_DIVERGENCE_LOG_DIR,
    appendMetricImpl = appendFile,
    mkdirImpl = mkdir,
  } = {}
) {
  const monthStamp = new Date(now).toISOString().slice(0, 7)
  const filePath = path.join(logDir, `storage-divergence-${monthStamp}.jsonl`)
  await mkdirImpl(path.dirname(filePath), { recursive: true })
  await appendMetricImpl(
    filePath,
    `${JSON.stringify({
      ts: new Date(now).toISOString(),
      ...record,
    })}\n`,
    'utf8'
  )
}
