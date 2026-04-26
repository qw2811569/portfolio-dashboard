import { withApiAuth } from './_lib/auth-middleware.js'
// Vercel Serverless Function — 策略大腦讀寫
// 本地檔案優先，Blob 為備份
import {
  deleteStoredAnalysisHistoryReport,
  readRecentAnalysisHistory,
  saveAnalysisHistoryReport,
} from './_lib/analysis-history.js'
import {
  LEGACY_EVENTS_KEY,
  LEGACY_HOLDINGS_KEY,
  readBrain,
  readBrainObject,
  writeBrain,
  writeBrainObject,
} from './_lib/brain-store.js'

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

async function handler(req, res) {
  try {
    // GET — 讀取
    if (req.method === 'GET') {
      const { action } = req.query

      if (action === 'brain') {
        return res.status(200).json({ brain: (await readBrain()) || EMPTY_BRAIN })
      }

      if (action === 'history') {
        return res.status(200).json({ history: await readRecentAnalysisHistory() })
      }

      if (action === 'all') {
        const brain = (await readBrain()) || EMPTY_BRAIN
        const history = await readRecentAnalysisHistory()
        return res.status(200).json({ brain, history })
      }

      return res.status(400).json({ error: '需要 action 參數 (brain/history/all)' })
    }

    // POST — 寫入
    if (req.method === 'POST') {
      const { action, data } = req.body

      if (action === 'save-brain') {
        await writeBrain(data)
        return res.status(200).json({ ok: true })
      }

      if (action === 'save-analysis') {
        await saveAnalysisHistoryReport(data)
        return res.status(200).json({ ok: true })
      }

      if (action === 'delete-analysis') {
        if (!data?.id || !data?.date) {
          return res.status(400).json({ error: '缺少要刪除的分析記錄資訊' })
        }
        await deleteStoredAnalysisHistoryReport(data)
        return res.status(200).json({ ok: true })
      }

      if (action === 'save-events') {
        await writeBrainObject(LEGACY_EVENTS_KEY, data)
        return res.status(200).json({ ok: true })
      }

      if (action === 'load-events') {
        return res.status(200).json({ events: await readBrainObject(LEGACY_EVENTS_KEY) })
      }

      if (action === 'save-holdings') {
        await writeBrainObject(LEGACY_HOLDINGS_KEY, data)
        return res.status(200).json({ ok: true })
      }

      if (action === 'load-holdings') {
        return res.status(200).json({ holdings: await readBrainObject(LEGACY_HOLDINGS_KEY) })
      }

      return res.status(400).json({ error: '未知 action' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    return res.status(200).json({ brain: EMPTY_BRAIN, history: [], events: [], holdings: [] })
  }
}

export default withApiAuth(handler)
