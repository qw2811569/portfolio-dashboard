import { withApiAuth } from './_lib/auth-middleware.js'
// Vercel Serverless Function — 策略大腦讀寫
// 本地檔案優先，Blob 為備份
import { put, list, del } from '@vercel/blob'
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { fetchSignedBlobJson, resolveSignedBlobOrigin } from './_lib/signed-url.js'

const TOKEN = process.env.PUB_BLOB_READ_WRITE_TOKEN
const BRAIN_KEY = 'strategy-brain.json'
const HISTORY_PREFIX = 'analysis-history/'
const HISTORY_INDEX_KEY = 'analysis-history-index.json'
const DATA_DIR = join(process.cwd(), 'data')
const EMPTY_BRAIN = {
  version: 4,
  rules: [],
  candidateRules: [],
  checklists: { preEntry: [], preAdd: [], preExit: [] },
  lessons: [],
  commonMistakes: [],
  stats: {},
  lastUpdate: null,
  coachLessons: [],
  evolution: '',
}

// ── 本地檔案讀寫 ──
function localPath(key) {
  return join(DATA_DIR, key.replace(/\//g, '__'))
}

function readLocal(key) {
  try {
    const p = localPath(key)
    if (!existsSync(p)) return null
    return JSON.parse(readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

function writeLocal(key, data) {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(localPath(key), JSON.stringify(data, null, 2))
  } catch (err) {
    console.warn('[api/brain] writeLocal failed:', err.message || err)
  }
}

function deleteLocal(key) {
  try {
    const p = localPath(key)
    if (existsSync(p)) unlinkSync(p)
  } catch (err) {
    console.warn('[api/brain] deleteLocal failed:', err.message || err)
  }
}

function buildHistoryKey(report) {
  return `${HISTORY_PREFIX}${report.date}-${report.id}.json`
}

// ── Blob 讀寫（best-effort）──
async function readBlob(blob, opts = {}) {
  return fetchSignedBlobJson(blob?.pathname || blob?.url, {
    origin: opts.origin,
    fetchImpl: opts.fetchImpl,
  })
}

async function readPath(pathname, opts) {
  try {
    const { blobs } = await list({ prefix: pathname, limit: 1, ...opts })
    if (!blobs.length) return null
    return readBlob(blobs[0], opts)
  } catch {
    return null
  }
}

async function replaceSingleton(pathname, data, opts) {
  try {
    await del(pathname, opts)
  } catch {
    /* best-effort cleanup before re-write — old blob may not exist */
  }
  if (data == null) return
  await put(pathname, JSON.stringify(data), {
    contentType: 'application/json',
    access: 'private',
    addRandomSuffix: false,
    ...opts,
  })
}

// ── 讀取策略：本地優先 → Blob 補缺 ──
async function read(key, opts) {
  const local = readLocal(key)
  if (local) return local
  const cloud = await readPath(key, opts)
  if (cloud) writeLocal(key, cloud) // 拉回本地快取
  return cloud
}

// ── 寫入策略：本地一定寫，Blob best-effort ──
async function write(key, data, opts) {
  writeLocal(key, data)
  try {
    await replaceSingleton(key, data, opts)
  } catch (err) {
    console.warn('[api/brain] blob write failed:', err.message || err)
  }
}

function normalizeHistoryReports(reports) {
  const byDate = new Map()
  ;(Array.isArray(reports) ? reports : []).forEach((report) => {
    if (!report || typeof report !== 'object') return
    const key = report.date ? `date:${report.date}` : `id:${report.id}`
    const prev = byDate.get(key)
    const reportId = Number(report.id) || 0
    const prevId = Number(prev?.id) || 0
    if (!prev || reportId >= prevId) {
      byDate.set(key, report)
    }
  })
  return Array.from(byDate.values())
    .sort((a, b) => (Number(b?.id) || 0) - (Number(a?.id) || 0))
    .slice(0, 30)
}

async function updateHistoryIndex(report, opts) {
  const current = (await read(HISTORY_INDEX_KEY, opts)) || []
  const next = normalizeHistoryReports([report, ...current])
  await write(HISTORY_INDEX_KEY, next, opts)
}

async function deleteHistoryReport(report, opts) {
  if (!report?.id || !report?.date) return
  const key = buildHistoryKey(report)
  const current = (await read(HISTORY_INDEX_KEY, opts)) || []
  const next = current.filter((item) => item.id !== report.id)
  deleteLocal(key)
  await write(HISTORY_INDEX_KEY, next, opts)
  try {
    await del(key, opts)
  } catch (err) {
    console.warn('[api/brain] blob delete (history report) failed:', err.message || err)
  }
}

async function deleteHistoryReportsByDate(date, keepId, opts) {
  if (!date) return
  const current = (await read(HISTORY_INDEX_KEY, opts)) || []
  const sameDateReports = current.filter((item) => item?.date === date && item?.id !== keepId)
  for (const report of sameDateReports) {
    const key = buildHistoryKey(report)
    deleteLocal(key)
    try {
      await del(key, opts)
    } catch (err) {
      console.warn('[api/brain] blob delete (history by date) failed:', err.message || err)
    }
  }
}

async function handler(req, res) {
  const opts = { token: TOKEN, origin: resolveSignedBlobOrigin(req) }

  try {
    // GET — 讀取
    if (req.method === 'GET') {
      const { action } = req.query

      if (action === 'brain') {
        return res.status(200).json({ brain: (await read(BRAIN_KEY, opts)) || EMPTY_BRAIN })
      }

      if (action === 'history') {
        const cached = await read(HISTORY_INDEX_KEY, opts)
        if (cached && cached.length > 0) {
          const normalized = normalizeHistoryReports(cached)
          if (normalized.length !== cached.length) {
            await write(HISTORY_INDEX_KEY, normalized, opts)
          }
          return res.status(200).json({ history: normalized })
        }
        try {
          const { blobs } = await list({ prefix: HISTORY_PREFIX, ...opts })
          const history = []
          for (const blob of blobs.sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, 30)) {
            history.push(await readBlob(blob, opts))
          }
          const normalized = normalizeHistoryReports(history)
          if (normalized.length > 0) writeLocal(HISTORY_INDEX_KEY, normalized)
          return res.status(200).json({ history: normalized })
        } catch {
          return res.status(200).json({ history: [] })
        }
      }

      if (action === 'all') {
        const brain = (await read(BRAIN_KEY, opts)) || EMPTY_BRAIN
        const history = (await read(HISTORY_INDEX_KEY, opts)) || []
        return res.status(200).json({ brain, history })
      }

      return res.status(400).json({ error: '需要 action 參數 (brain/history/all)' })
    }

    // POST — 寫入
    if (req.method === 'POST') {
      const { action, data } = req.body

      if (action === 'save-brain') {
        await write(BRAIN_KEY, data, opts)
        return res.status(200).json({ ok: true })
      }

      if (action === 'save-analysis') {
        await deleteHistoryReportsByDate(data?.date, data?.id, opts)
        const key = buildHistoryKey(data)
        writeLocal(key, data)
        try {
          await put(key, JSON.stringify(data), {
            contentType: 'application/json',
            access: 'private',
            addRandomSuffix: false,
            ...opts,
          })
        } catch (err) {
          console.warn('[api/brain] blob persist (save-analysis) failed:', err.message || err)
        }
        await updateHistoryIndex(data, opts)
        return res.status(200).json({ ok: true })
      }

      if (action === 'delete-analysis') {
        if (!data?.id || !data?.date) {
          return res.status(400).json({ error: '缺少要刪除的分析記錄資訊' })
        }
        await deleteHistoryReport(data, opts)
        return res.status(200).json({ ok: true })
      }

      if (action === 'save-events') {
        await write('events.json', data, opts)
        return res.status(200).json({ ok: true })
      }

      if (action === 'load-events') {
        return res.status(200).json({ events: await read('events.json', opts) })
      }

      if (action === 'save-holdings') {
        await write('holdings.json', data, opts)
        return res.status(200).json({ ok: true })
      }

      if (action === 'load-holdings') {
        return res.status(200).json({ holdings: await read('holdings.json', opts) })
      }

      return res.status(400).json({ error: '未知 action' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    return res.status(200).json({ brain: EMPTY_BRAIN, history: [], events: [], holdings: [] })
  }
}

export default withApiAuth(handler)
