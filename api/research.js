// Vercel Serverless Function — AutoResearch 自主進化系統
// 借鑒 karpathy/autoresearch：AI 自主多輪迭代，累積進化
// 不只研究股票，而是審視整個投資系統並自我改善
import { put, list, del } from '@vercel/blob'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { callAiText, ensureAiConfigured } from './_lib/ai-provider.js'
import { normalizeStrategyBrain } from '../src/lib/brainRuntime.js'
import { buildKnowledgeEvolutionProposal } from '../src/lib/knowledgeEvolutionRuntime.js'
import { buildCompactKnowledgeContext, buildKnowledgeContext } from '../src/lib/knowledgeBase.js'
import {
  buildBudgetedBrainContext,
  buildBudgetedHoldingSummary,
  formatRecentLessons,
} from '../src/lib/promptBudget.js'
import { evaluateBrainProposal } from '../src/lib/researchProposalRuntime.js'
import { buildFinMindChipContext } from '../src/lib/dossierUtils.js'
import {
  normalizeResearchRequestInput,
  summarizeResearchRequestInput,
  validateResearchRequestInput,
} from '../src/lib/researchRequestRuntime.js'

const TOKEN = process.env.PUB_BLOB_READ_WRITE_TOKEN
const RESEARCH_INDEX_KEY = 'research-index.json'
const BRAIN_PROPOSAL_PREFIX = 'brain-proposals'
const DATA_DIR = join(process.cwd(), 'data')

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
    console.warn('[api/research] writeLocal failed:', err.message || err)
  }
}

async function read(key) {
  const local = readLocal(key)
  if (local) return local
  try {
    const { blobs } = await list({ prefix: key, limit: 1, token: TOKEN })
    if (!blobs.length) return null
    const r = await fetch(blobs[0].url)
    const data = await r.json()
    writeLocal(key, data)
    return data
  } catch {
    return null
  }
}

async function write(key, data) {
  writeLocal(key, data)
  try {
    try {
      await del(key, { token: TOKEN })
    } catch {
      /* best-effort cleanup before re-write — old blob may not exist */
    }
    await put(key, JSON.stringify(data), {
      access: 'public',
      token: TOKEN,
      contentType: 'application/json',
      addRandomSuffix: false,
    })
  } catch (err) {
    console.warn('[api/research] blob write failed:', err.message || err)
  }
}

async function callClaude(system, user, maxTokens = 4000) {
  return callAiText({ system, user, maxTokens })
}

/**
 * Type-aware strategy framework — copied verbatim from
 * src/lib/dailyAnalysisRuntime.js so research and daily analysis speak the
 * same numeric thresholds. Injected into every per-holding system prompt in
 * this file (Round 1 batch scan, Round 1 single-stock loop, and the
 * single-mode deep research paths). Portfolio-level prompts (system
 * diagnosis, brain evolution) deliberately do NOT include it — they reason
 * across the whole portfolio, not per-holding.
 *
 * Per multi-LLM consensus round (.tmp/research-prompt-fix/), the frameworks
 * are copied verbatim rather than condensed so numeric thresholds survive
 * drift, and the `position.type` field is already exposed via
 * buildResearchDossierContext (`持倉：權證 | ...`) so the LLM has everything
 * it needs to route between frameworks.
 */
export const TYPE_AWARE_FRAMEWORK_GUIDE = `⚠️ 持股類型框架路由（必讀）：
不同 position.type 用不同策略框架分析，禁止一套邏輯套用全部。
dossier 第一行「持倉：<type> | ...」已標示型別，請依型別切換下方框架。

【權證策略框架】（type='權證'，不談基本面）
- Delta 最佳區間 0.4-0.7，低於 0.3 考慮換約至價平附近
- 到期前 30 天 Theta 加速衰減 → 提前 40 天評估滾動換約
- 隱含波動率(IV)偏高時不追買，等 IV 回落再進場
- 出場紀律：到達目標價分批出 1/2 → 1/4，剩餘部位設追蹤停利
- 標的股漲但權證沒跟 → 檢查造市商報價、IV crush
- 禁止用 PEG / EPS / 營收 YoY 等基本面指標下判斷

【ETF/指數策略框架】（type='ETF' 或 '指數'）
- 總經面向：央行政策方向、PMI趨勢、匯率走勢
- 槓桿 ETF 波動耗損：持有超過 2 週需計算實際追蹤偏差
- RSI >70 超買減碼、RSI <30 超賣可佈局
- 停損紀律：正2型 ETF 虧損 >15% 必須檢討是否該停損
- 禁止用個股 EPS / 營收 YoY 等公司級指標下判斷

【股票策略框架】（type='股票'）
- 使用原本的 thesis / 財務體質 / 催化劑 / 事件驗證點流程
- PEG、營收月增、法人連續買超、目標價 freshness 等皆適用`

async function updateResearchIndex(report) {
  const current = readLocal(RESEARCH_INDEX_KEY) || []
  const next = [report, ...current.filter((item) => item.timestamp !== report.timestamp)]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 30)
  await write(RESEARCH_INDEX_KEY, next)
}

function buildBrainProposal({
  proposalId,
  parsedBrain,
  currentBrain,
  today,
  mode,
  diagnostics,
  advice,
}) {
  if (!parsedBrain || typeof parsedBrain !== 'object') return null
  const evaluation = evaluateBrainProposal({ proposedBrain: parsedBrain }, currentBrain)
  return {
    id: proposalId,
    status: evaluation.passed ? 'candidate' : 'blocked',
    createdAt: new Date().toISOString(),
    date: today,
    mode,
    summary: String(parsedBrain.evolution || '').trim() || '候選策略提案已生成',
    diagnostics,
    advice,
    evaluation,
    metrics: {
      ruleCount: Array.isArray(parsedBrain.rules) ? parsedBrain.rules.length : 0,
      candidateRuleCount: Array.isArray(parsedBrain.candidateRules)
        ? parsedBrain.candidateRules.length
        : 0,
      lessonCount: Array.isArray(parsedBrain.lessons) ? parsedBrain.lessons.length : 0,
    },
    proposedBrain: parsedBrain,
  }
}

function formatKnowledgeProposalContent(proposal) {
  if (!proposal || typeof proposal !== 'object') {
    return '⚠️ 知識庫演化提案生成失敗，請手動檢查'
  }

  const adjustments = Array.isArray(proposal.confidenceAdjustments)
    ? proposal.confidenceAdjustments
    : []

  const preview =
    adjustments.length > 0
      ? adjustments
          .slice(0, 5)
          .map(
            (item) =>
              `- ${item.id} ${item.title}：${Math.round(item.fromConfidence * 100)}% → ${Math.round(item.toConfidence * 100)}%（${item.reason}）`
          )
          .join('\n')
      : '目前 feedback 與 usage 訊號不足，暫無 confidence 調整。'

  return `🧠 ${proposal.summary || '知識庫演化提案已生成'}

狀態：${proposal.status || 'unknown'}
Gate：${proposal.evaluation?.summary || '尚未評估'}
調整筆數：${proposal.metrics?.adjustmentCount || adjustments.length}
有 linked feedback 的回饋：${proposal.metrics?.feedbackLinkedCount || 0}
缺少 injectedKnowledgeIds 的回饋：${proposal.metrics?.feedbackMissingLinkCount || 0}

${preview}`
}

function normalizeHoldingDossiers(value) {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === 'object' && typeof item.code === 'string')
    : []
}

function compactInlineText(value, limit = 40) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  if (text.length <= limit) return text
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
}

function formatPromptNumber(value, digits = 1) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return digits === 0 ? String(Math.round(num)) : num.toFixed(digits)
}

function formatFreshnessLabel(status) {
  if (status === 'fresh') return '新'
  if (status === 'stale') return '舊'
  return '缺'
}

function summarizeTargetReports(reports, limit = 2) {
  const rows = (Array.isArray(reports) ? reports : [])
    .map((report) => {
      const firm = report?.firm || '未署名'
      const target = Number(report?.target)
      const date = report?.date || '日期未知'
      if (!Number.isFinite(target) || target <= 0) return null
      return `${firm} ${target} (${date})`
    })
    .filter(Boolean)
  return rows.length > 0 ? rows.slice(0, limit).join('；') : '無'
}

function summarizeEventList(items, limit = 3) {
  const rows = (Array.isArray(items) ? items : [])
    .map((event) => {
      const label = event?.title || '未命名事件'
      const date = event?.date || event?.trackingStart || event?.exitDate || '日期未定'
      const status = event?.status || 'pending'
      return `${label}(${date}/${status})`
    })
    .filter(Boolean)
  return rows.length > 0 ? rows.slice(0, limit).join('；') : '無'
}

function formatFundamentalsSummary(entry) {
  if (!entry || typeof entry !== 'object') return '尚未建立'
  const parts = [
    entry.revenueMonth ? `${entry.revenueMonth} 營收` : null,
    Number.isFinite(Number(entry.revenueYoY))
      ? `YoY ${Number(entry.revenueYoY) >= 0 ? '+' : ''}${Number(entry.revenueYoY).toFixed(1)}%`
      : null,
    Number.isFinite(Number(entry.revenueMoM))
      ? `MoM ${Number(entry.revenueMoM) >= 0 ? '+' : ''}${Number(entry.revenueMoM).toFixed(1)}%`
      : null,
    Number.isFinite(Number(entry.eps)) ? `EPS ${Number(entry.eps).toFixed(2)}` : null,
    Number.isFinite(Number(entry.grossMargin))
      ? `毛利率 ${Number(entry.grossMargin).toFixed(1)}%`
      : null,
    Number.isFinite(Number(entry.roe)) ? `ROE ${Number(entry.roe).toFixed(1)}%` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : '尚未建立'
}

function formatPortfolioNotesContext(notes) {
  if (!notes || typeof notes !== 'object') return '個人備註：無'
  const lines = [
    notes.riskProfile ? `風險屬性：${notes.riskProfile}` : null,
    notes.preferences ? `操作偏好：${notes.preferences}` : null,
    notes.customNotes ? `自訂備註：${notes.customNotes}` : null,
  ].filter(Boolean)
  return lines.length > 0 ? `個人備註：\n${lines.join('\n')}` : '個人備註：無'
}

function brainRuleText(rule) {
  if (typeof rule === 'string') return rule.trim()
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return ''
  return String(rule.text || rule.rule || '').trim()
}

function brainRuleStalenessLabel(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  if (normalized === 'fresh') return '新鮮'
  if (normalized === 'aging') return '待更新'
  if (normalized === 'stale') return '陳舊'
  if (normalized === 'missing') return '未驗證'
  return ''
}

function brainRuleEvidenceSummary(evidenceRefs, limit = 2) {
  const refs = Array.isArray(evidenceRefs) ? evidenceRefs.filter(Boolean) : []
  if (refs.length === 0) return null
  const labels = refs
    .map((ref) => String(ref?.label || '').trim())
    .filter(Boolean)
    .slice(0, limit)
  if (labels.length === 0) return `證據${refs.length}筆`
  return `證據${refs.length}筆：${labels.join('、')}${refs.length > limit ? '…' : ''}`
}

function brainRuleSummary(rule) {
  const text = brainRuleText(rule)
  if (!text) return ''
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return text
  const meta = [
    rule.when ? `條件:${rule.when}` : null,
    rule.action ? `動作:${rule.action}` : null,
    rule.scope ? `範圍:${rule.scope}` : null,
    Number.isFinite(Number(rule.confidence))
      ? `信心${Math.round(Number(rule.confidence))}/10`
      : null,
    Number.isFinite(Number(rule.evidenceCount)) && Number(rule.evidenceCount) > 0
      ? `驗證${Math.round(Number(rule.evidenceCount))}次`
      : null,
    Number.isFinite(Number(rule.validationScore))
      ? `驗證分${Math.round(Number(rule.validationScore))}`
      : null,
    rule.lastValidatedAt ? `最近驗證${rule.lastValidatedAt}` : null,
    brainRuleStalenessLabel(rule.staleness)
      ? `狀態:${brainRuleStalenessLabel(rule.staleness)}`
      : null,
    brainRuleEvidenceSummary(rule.evidenceRefs) || null,
  ].filter(Boolean)
  return meta.length > 0 ? `${text}（${meta.join('｜')}）` : text
}

function summarizeBrainRules(rules, limit = 4) {
  const rows = (Array.isArray(rules) ? rules : []).map(brainRuleSummary).filter(Boolean)
  return rows.length > 0 ? rows.slice(0, limit).join('；') : '無'
}

function summarizeBrainChecklists(checklists) {
  if (!checklists || typeof checklists !== 'object') return '無'
  const sections = [
    Array.isArray(checklists.preEntry) && checklists.preEntry.length > 0
      ? `進場前：${checklists.preEntry.join('；')}`
      : null,
    Array.isArray(checklists.preAdd) && checklists.preAdd.length > 0
      ? `加碼前：${checklists.preAdd.join('；')}`
      : null,
    Array.isArray(checklists.preExit) && checklists.preExit.length > 0
      ? `出場前：${checklists.preExit.join('；')}`
      : null,
  ].filter(Boolean)
  return sections.length > 0 ? sections.join('\n') : '無'
}

function buildResearchBrainContext(brain) {
  const normalizedBrain = normalizeStrategyBrain(brain, { allowEmpty: true })
  const hasContent =
    (normalizedBrain.rules || []).length > 0 ||
    (normalizedBrain.candidateRules || []).length > 0 ||
    (normalizedBrain.lessons || []).length > 0 ||
    (normalizedBrain.commonMistakes || []).length > 0 ||
    Object.keys(normalizedBrain.stats || {}).length > 0

  if (!hasContent) return '（尚未建立）'

  const userRules = (normalizedBrain.rules || []).filter((rule) => rule?.source === 'user')
  const aiRules = (normalizedBrain.rules || []).filter((rule) => rule?.source !== 'user')
  const recentLessons = formatRecentLessons(normalizedBrain.lessons || [], { limit: 6 })
  const recentLessonBudget = formatRecentLessons(normalizedBrain.lessons || [], { limit: 3 })
  const fullText = [
    '══ 策略大腦 ══',
    userRules.length > 0 ? `✅ 用戶確認規則：\n${summarizeBrainRules(userRules, 8)}` : '',
    aiRules.length > 0 ? `🤖 核心規則：\n${summarizeBrainRules(aiRules, 8)}` : '',
    (normalizedBrain.candidateRules || []).length > 0
      ? `🧪 候選規則：\n${summarizeBrainRules(normalizedBrain.candidateRules, 4)}`
      : '',
    `📋 決策檢查表：\n${summarizeBrainChecklists(normalizedBrain.checklists)}`,
    recentLessons ? `📚 最近教訓：\n${recentLessons}` : '',
    `⚠️ 常犯錯誤：${(normalizedBrain.commonMistakes || []).join('、') || '無'}`,
    `📈 勝率統計：${normalizedBrain.stats?.hitRate || '尚無'}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  return buildBudgetedBrainContext({
    fullText,
    userRulesText: summarizeBrainRules(userRules, 6),
    recentLessonsText: recentLessonBudget,
    maxChars: 1500,
  }).text
}

function buildResearchDossierContext(dossier, { compact = false } = {}) {
  if (!dossier) return '無 dossier，可依持倉與 meta 基本資料分析。'
  const position = dossier.position || {}
  const meta = dossier.meta || dossier.stockMeta || {}
  const thesis = dossier.thesis || {}
  const targets = dossier.targets || {}
  const fundamentals = dossier.fundamentals || {}
  const analyst = dossier.analyst || {}
  const events = dossier.events || {}
  const research = dossier.research || {}
  const brainContext = dossier.brainContext || {}
  const freshness = dossier.freshness || {}
  const finmind = dossier.finmind || {}
  const knowledgeContext = compact
    ? buildCompactKnowledgeContext(meta, { maxItems: 3, maxCaseItems: 1 })
    : buildKnowledgeContext(meta)
  const finmindContext = buildFinMindChipContext(finmind)

  return [
    `【${dossier.name}(${dossier.code})】`,
    `持倉：${position.type || '股票'} | 現價 ${formatPromptNumber(position.price)} 成本 ${formatPromptNumber(position.cost)} | 累計 ${Number(position.pct) >= 0 ? '+' : ''}${formatPromptNumber(position.pct, 2)}% | 股數 ${formatPromptNumber(position.qty, 0)}`,
    `定位：${meta.industry || '未分類'} / ${meta.strategy || '未分類'} / ${meta.period || '?'}期 / ${meta.position || '未定'} / ${meta.leader || '未知'}`,
    thesis.summary ? `thesis：${thesis.summary}` : null,
    thesis.catalyst ? `催化劑：${thesis.catalyst}` : null,
    thesis.status ? `狀態：${thesis.status}` : null,
    targets.avgTarget
      ? `目標價：均值 ${formatPromptNumber(targets.avgTarget, 0)}；${summarizeTargetReports(targets.reports, compact ? 2 : 3)}`
      : '目標價：無',
    fundamentals.eps != null ||
    fundamentals.grossMargin != null ||
    fundamentals.roe != null ||
    fundamentals.revenueYoY != null
      ? `財報/營收：${formatFundamentalsSummary(fundamentals)}${fundamentals.source ? `；來源 ${fundamentals.source}` : ''}`
      : '財報/營收：無',
    analyst.latestSummary ? `公開報告：${analyst.latestSummary}` : '公開報告：無',
    `事件：待觀察 ${summarizeEventList(events.pending, compact ? 2 : 3)} | 追蹤中 ${summarizeEventList(events.tracking, compact ? 2 : 3)}`,
    research.latestConclusion ? `最近研究：${research.latestConclusion}` : '最近研究：無',
    Array.isArray(brainContext.matchedRules) && brainContext.matchedRules.length > 0
      ? `相關規則：${brainContext.matchedRules
          .slice(0, compact ? 2 : 4)
          .map(brainRuleSummary)
          .join('；')}`
      : null,
    Array.isArray(brainContext.matchedCandidateRules) &&
    brainContext.matchedCandidateRules.length > 0
      ? `候選規則：${brainContext.matchedCandidateRules
          .slice(0, compact ? 2 : 3)
          .map(brainRuleSummary)
          .join('；')}`
      : null,
    Array.isArray(brainContext.matchedMistakes) && brainContext.matchedMistakes.length > 0
      ? `常見風險：${brainContext.matchedMistakes.slice(0, compact ? 2 : 4).join('；')}`
      : null,
    finmindContext ? `FinMind：\n${finmindContext}` : null,
    knowledgeContext ? `知識庫參考：\n${knowledgeContext}` : null,
    `資料新鮮度：價格${formatFreshnessLabel(freshness.price)} / 目標價${formatFreshnessLabel(freshness.targets)} / 財報${formatFreshnessLabel(freshness.fundamentals)} / 研究${formatFreshnessLabel(freshness.research)}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function getSingleResearchRoundCount() {
  return process.env.VERCEL_ENV === 'production' ? 3 : 1
}

function getPortfolioResearchRoundMode() {
  return process.env.VERCEL_ENV === 'production' ? 'full' : 'local-fast'
}

function parseJsonText(text = '') {
  const cleaned = String(text || '')
    .replace(/```json|```/gi, '')
    .trim()
  if (!cleaned) return null
  try {
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

function buildPortfolioFallbackSummary(stock, dossier, metaEntry) {
  const thesisText = compactInlineText(
    dossier?.thesis?.summary || dossier?.thesis?.statement || dossier?.research?.latestConclusion,
    32
  )
  const target = Number(dossier?.targets?.avgTarget)
  const finmindReady = buildFinMindChipContext(dossier?.finmind) ? 'FinMind有' : 'FinMind缺'
  const strategy = compactInlineText(
    metaEntry?.strategy ||
      dossier?.meta?.strategy ||
      dossier?.stockMeta?.strategy ||
      stock?.type ||
      '未分類',
    12
  )
  return [
    strategy,
    thesisText || '需補研究',
    Number.isFinite(target) ? `目標${Math.round(target)}` : '目標待補',
    finmindReady,
  ]
    .filter(Boolean)
    .join(' | ')
}

function normalizePortfolioStockSummaries(rawText, universeStocks, dossierByCode, meta) {
  const parsed = parseJsonText(rawText)
  const entries = Array.isArray(parsed) ? parsed : []
  const entryByCode = new Map(
    entries.map((entry) => [String(entry?.code || '').trim(), entry]).filter(([code]) => code)
  )

  return (Array.isArray(universeStocks) ? universeStocks : []).map((stock) => {
    const entry = entryByCode.get(stock.code)
    const dossier = dossierByCode.get(stock.code) || null
    const metaEntry = meta?.[stock.code] || {}

    if (!entry) {
      return {
        code: stock.code,
        name: stock.name,
        summary: buildPortfolioFallbackSummary(stock, dossier, metaEntry),
        meta: metaEntry,
        stock,
      }
    }

    const summary = [
      compactInlineText(entry?.thesisStatus, 28),
      compactInlineText(entry?.actionBias, 24),
      compactInlineText(entry?.validationPoint ? `驗證:${entry.validationPoint}` : '', 28),
      Number.isFinite(Number(entry?.confidence))
        ? `信心${Math.round(Number(entry.confidence))}/10`
        : '',
    ]
      .filter(Boolean)
      .join(' | ')

    return {
      code: stock.code,
      name: stock.name,
      summary: summary || buildPortfolioFallbackSummary(stock, dossier, metaEntry),
      meta: metaEntry,
      stock,
    }
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  try {
    ensureAiConfigured()
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  // GET: 讀取歷史研究報告（本地優先）
  if (req.method === 'GET') {
    try {
      const { code } = req.query
      const cached = (await read(RESEARCH_INDEX_KEY)) || []
      if (cached.length > 0) {
        const reports = code
          ? cached.filter((r) => r.code === code).slice(0, 10)
          : cached.slice(0, 10)
        return res.status(200).json({ reports })
      }
      const prefix = code ? `research/${code}/` : 'research/'
      const blobs = await list({ prefix, token: TOKEN })
      const reports = []
      for (const blob of blobs.blobs.sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, 10)) {
        const r = await fetch(blob.url)
        reports.push(await r.json())
      }
      if (reports.length > 0) writeLocal(RESEARCH_INDEX_KEY, reports)
      return res.status(200).json({ reports })
    } catch {
      return res.status(200).json({ reports: [] })
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Streaming support for evolve/portfolio mode (prevents timeout)
  const wantsStream = String(req.query?.stream || '').trim() === '1'
  function sendProgress(res, event, data) {
    if (!wantsStream) return
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    } catch {
      /* connection closed */
    }
  }

  const normalizedRequest = normalizeResearchRequestInput(req.body || {})
  const {
    stocks,
    holdings,
    holdingDossiers,
    meta,
    brain,
    events,
    analysisHistory,
    portfolioNotes,
    knowledgeUsageLog,
    knowledgeFeedbackLog,
    mode,
    persist = true,
  } = normalizedRequest

  try {
    const today = new Date().toLocaleDateString('zh-TW')
    const results = []
    const dossiers = normalizeHoldingDossiers(holdingDossiers)
    const dossierByCode = new Map(dossiers.map((item) => [item.code, item]))
    const notesContext = formatPortfolioNotesContext(portfolioNotes)
    const requestSummary = summarizeResearchRequestInput({
      ...normalizedRequest,
      holdingDossiers: dossiers,
    })
    const validationError = validateResearchRequestInput({ mode, stocks, holdings })

    console.debug('[research] request', requestSummary)

    if (validationError) {
      console.warn('[research] invalid request', {
        ...requestSummary,
        validationError,
      })
      return res.status(400).json({
        error: validationError,
        requestSummary,
      })
    }

    if (mode === 'single' && stocks?.length === 1) {
      // ── 單股深度研究：本地快速版 1 輪 / production 3 輪 ──
      const s = stocks[0]
      const m = meta?.[s.code] || {}
      const dossier = dossierByCode.get(s.code) || null
      const holdingRow = holdings?.find((h) => h.code === s.code) || null
      const researchRoundCount = getSingleResearchRoundCount()
      const dossierContext = buildBudgetedHoldingSummary(
        [
          {
            key: s.code,
            code: s.code,
            name: s.name,
            text: buildResearchDossierContext(dossier),
            weight:
              Number(holdingRow?.qty || dossier?.position?.qty || 0) *
              Number(s.price || dossier?.position?.price || 0),
          },
        ],
        { maxChars: 3000, maxEntries: 1 }
      ).text

      console.debug('[research] single prompt ready', {
        code: s.code,
        name: s.name,
        researchRoundCount,
        dossierChars: dossierContext.length,
        noteChars: notesContext.length,
      })

      if (researchRoundCount === 1) {
        const brainCtx = brain ? buildResearchBrainContext(brain) : ''
        const singlePass = await callClaude(
          `你是專業的台股研究分析師兼持倉策略顧問。你必須先讀完整的持股 dossier，再對「${s.name}(${s.code})」做一輪完整深度研究。
如果 dossier 標示某些欄位是 stale 或 missing，要直接說出不確定性，不要虛構最新財報或投顧數字。
產業：${m.industry || '未分類'} | 策略：${m.strategy || '未分類'} | 產業地位：${m.leader || '未知'}

${TYPE_AWARE_FRAMEWORK_GUIDE}`,
          `${notesContext}

持股 dossier：
${dossierContext}

${brainCtx}
股票：${s.name}(${s.code}) | 現價：${s.price} | 成本：${s.cost} | 損益：${s.pnl >= 0 ? '+' : ''}${s.pnl}(${s.pct}%)

請一次完成：
1. 公司定位與護城河：主要業務、競爭優勢、市場地位，並檢查 thesis 是否仍成立
2. 財務體質：營收、毛利率、EPS、ROE、估值與籌碼摘要；若缺資料要明講
3. 產業趨勢與事件驗證點：未來 1-2 季展望、法說/財報/目標價 freshness、最近待觀察事件
4. 反面風險：最可能導致 thesis 失效的 2-3 個風險
5. 操作建議：具體到價位/條件/觀察點，並補一句「如果我錯了」

請用繁中輸出，保持 5 個小節，直接給可執行結論，不要空泛描述。`
        )

        const report = {
          code: s.code,
          name: s.name,
          date: today,
          timestamp: Date.now(),
          mode: 'single',
          roundMode: 'local-fast',
          rounds: [{ title: '深度研究（本地快速版）', content: singlePass }],
          meta: m,
          priceAtResearch: s.price,
        }
        if (persist) {
          writeLocal(`research/${s.code}/${Date.now()}.json`, report)
          await updateResearchIndex(report)
        }
        if (persist && TOKEN) {
          try {
            await put(`research/${s.code}/${Date.now()}.json`, JSON.stringify(report), {
              access: 'public',
              token: TOKEN,
              contentType: 'application/json',
            })
          } catch (err) {
            console.warn('[api/research] blob persist (single-fast) failed:', err.message || err)
          }
        }
        results.push(report)
      } else {
        const round1 = await callClaude(
          `你是專業的台股研究分析師。你必須先讀完整的持股 dossier，再對「${s.name}(${s.code})」做研究。
如果 dossier 標示某些欄位是 stale 或 missing，要直接說出不確定性，不要虛構最新財報或投顧數字。
產業：${m.industry || '未分類'} | 策略：${m.strategy || '未分類'} | 產業地位：${m.leader || '未知'}

${TYPE_AWARE_FRAMEWORK_GUIDE}`,
          `${notesContext}

持股 dossier：
${dossierContext}

請對 ${s.name}(${s.code}) 進行深度基本面分析：

1. **公司定位與護城河**：主要業務、競爭優勢、市場地位，並檢查現有 thesis 是否仍成立
2. **財務體質**：根據 dossier 內已知資訊評估近期營收趨勢、毛利率走勢、EPS 軌跡、ROE；若缺資料要說明
3. **產業趨勢**：所處產業的景氣循環位置、未來 1-2 季展望
4. **投顧/目標價支撐**：目前目標價共識是否支持 thesis？若資料偏舊請明講
5. **技術面與事件驗證點**：支撐、壓力、均線結構，以及最近待觀察事件如何影響判斷

現價：${s.price} | 成本：${s.cost} | 損益：${s.pnl >= 0 ? '+' : ''}${s.pnl}(${s.pct}%)

請用 dossier 內已有的具體數據和邏輯推演，不要空泛描述。`
        )

        const round2 = await callClaude(
          `你是台股風險評估專家，你的工作是挑戰 Round 1 的結論。
如果 Round 1 看多，你要找出看空的理由；如果 Round 1 看空，你要找出被低估的可能。
你的價值在於找到分析師遺漏的風險，而不是附和前一輪的結論。
禁止使用「短期震盪不改長期趨勢」「逢低布局」「持續觀察」等模糊用語。

${TYPE_AWARE_FRAMEWORK_GUIDE}`,
          `${notesContext}
持股 dossier：\n${dossierContext}\n\n前一輪分析結果：\n${round1}\n\n你的任務是反駁上面的分析，請：
1. **挑戰 Round 1 結論**：Round 1 的判斷哪裡可能是錯的？有什麼被忽略的反面證據？
2. **主要風險因子**：最可能導致下跌的 3 個因素（必須給具體情境和觸發條件）
3. **催化劑失效風險**：Round 1 提到的催化劑為什麼可能不會實現？或已被市場定價？
4. **同業比較**：vs 同產業對手的估值差異，是否有更好的替代標的？
5. **黑天鵝情境**：最壞情況下的股價目標和虧損金額

現有持倉：${s.code} 持有 ${holdingRow?.qty || '?'}股，成本 ${s.cost}`
        )

        const brainCtx = brain ? buildResearchBrainContext(brain) : ''
        const round3 = await callClaude(
          `你是持倉策略顧問。綜合所有研究結果，給出明確的操作建議。

${TYPE_AWARE_FRAMEWORK_GUIDE}`,
          `${notesContext}
持股 dossier：\n${dossierContext}\n\n基本面分析：\n${round1}\n\n風險催化劑分析：\n${round2}\n\n${brainCtx}
股票：${s.name}(${s.code}) | 策略定位：${m.strategy}/${m.period}期/${m.position}

請給出：
1. **研究結論**：一句話總結（看多/看空/中性+信心度1-10）
2. **操作建議**：具體的買賣策略（何時加碼/減碼/停損，目標價位），要明確引用 dossier 中的 thesis / 目標價 / 事件
3. **關鍵觀察指標**：接下來最需要追蹤的 3 個指標/事件，並標明哪些資料目前偏舊
4. **持倉調整建議**：是否調整倉位大小、持有週期`
        )

        const report = {
          code: s.code,
          name: s.name,
          date: today,
          timestamp: Date.now(),
          mode: 'single',
          roundMode: 'full',
          rounds: [
            { title: '基本面深度分析', content: round1 },
            { title: '風險與催化劑', content: round2 },
            { title: '策略建議', content: round3 },
          ],
          meta: m,
          priceAtResearch: s.price,
        }
        if (persist) {
          writeLocal(`research/${s.code}/${Date.now()}.json`, report)
          await updateResearchIndex(report)
        }
        if (persist && TOKEN) {
          try {
            await put(`research/${s.code}/${Date.now()}.json`, JSON.stringify(report), {
              access: 'public',
              token: TOKEN,
              contentType: 'application/json',
            })
          } catch (err) {
            console.warn('[api/research] blob persist (single-full) failed:', err.message || err)
          }
        }
        results.push(report)
      }
    } else if (mode === 'evolve' || mode === 'portfolio') {
      // ══════════════════════════════════════════════════════════════
      // ── 統一的全組合研究 + 系統進化流程（4 輪迭代）──
      // ══════════════════════════════════════════════════════════════
      // 合併了舊的 portfolio（個股掃描+組合建議）和 evolve（系統診斷+大腦進化）
      // 現在不管從哪個按鈕觸發，都走同一個完整流程

      // 如果是 streaming 模式，設置 SSE headers 防止 timeout
      if (wantsStream) {
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache, no-transform')
        res.setHeader('Connection', 'keep-alive')
        res.flushHeaders?.()
        sendProgress(res, 'start', { mode, stocks: stocks?.length || 0 })
      }

      const brainCtx = brain ? buildResearchBrainContext(brain) : '（尚未建立）'
      const evtSummary = (events || [])
        .slice(0, 15)
        .map(
          (e) =>
            `[${e.correct === true ? '✓' : e.correct === false ? '✗' : '⏳'}] ${e.date} ${e.title} 預測${e.pred === 'up' ? '漲' : '跌'} ${e.actualNote || ''}`
        )
        .join('\n')
      const histSummary = (analysisHistory || [])
        .slice(0, 5)
        .map(
          (r) =>
            `${r.date} 損益${r.totalTodayPnl >= 0 ? '+' : ''}${r.totalTodayPnl} ${r.aiInsight ? r.aiInsight.slice(0, 200) + '...' : ''}`
        )
        .join('\n---\n')

      // ── Round 1：個股快掃（由下往上）──
      const researchUniverseStocks =
        Array.isArray(stocks) && stocks.length > 0 ? stocks : holdings || []
      const portfolioRoundMode = getPortfolioResearchRoundMode()
      let stockSummaries = []
      let stockSummaryText = '目前沒有持股摘要。'

      if (portfolioRoundMode === 'local-fast') {
        const portfolioScanContext =
          buildBudgetedHoldingSummary(
            researchUniverseStocks.slice(0, 20).map((s) => {
              const dossier = dossierByCode.get(s.code) || null
              return {
                key: s.code,
                code: s.code,
                name: s.name,
                weight: Number(s?.value) || Number(s?.price || 0) * Number(s?.qty || 0),
                text: buildResearchDossierContext(dossier, { compact: true }),
              }
            }),
            { maxChars: 12000, maxEntries: 25, joiner: '\n\n' }
          ).text || '目前沒有持股摘要。'

        const stockScanText = await callClaude(
          `你是台股組合研究員。請先讀完整個持股清單 dossier，再一次快掃所有持股。回傳純 JSON 陣列，不要 markdown。

${TYPE_AWARE_FRAMEWORK_GUIDE}`,
          `${notesContext}

持股清單 dossier：
${portfolioScanContext}

請依照輸入持股順序，對每一檔輸出一筆 JSON：
[{"code":"2330","name":"台積電","thesisStatus":"一句話判斷 thesis 是否仍成立","actionBias":"一句話操作方向","validationPoint":"一句話最大驗證點","confidence":1到10}]

要求：
1. 每檔都要出現且只出現一次
2. thesisStatus / actionBias / validationPoint 各限 18 字內
3. 若資料偏舊，直接在文字中點出
4. 不要輸出任何 JSON 以外的說明文字`,
          3500
        )

        stockSummaries = normalizePortfolioStockSummaries(
          stockScanText,
          researchUniverseStocks,
          dossierByCode,
          meta
        )
        stockSummaryText =
          stockSummaries
            .map(
              (item) =>
                `${item.name}(${item.code})[${item.meta.industry || ''}/${item.meta.position || ''}]: ${item.summary}`
            )
            .join('\n\n') || '目前沒有持股摘要。'
      } else {
        for (const s of researchUniverseStocks.slice(0, 20)) {
          const m = meta?.[s.code] || {}
          const dossier = dossierByCode.get(s.code) || null
          const dossierContext = buildResearchDossierContext(dossier, { compact: true })
          const summary = await callClaude(
            `你是台股分析師。先讀這檔持股的 dossier，再用 120 字內精要分析這檔持股的當前狀態和操作方向。

${TYPE_AWARE_FRAMEWORK_GUIDE}`,
            `${notesContext}
${dossierContext}

請給出：
1. thesis 是否仍成立（1句）
2. 當前操作方向（1句）
3. 最大驗證點（1句）
4. 信心度(1-10)
如果資料偏舊，請在摘要中直接點出。`,
            800
          )
          stockSummaries.push({ code: s.code, name: s.name, summary, meta: m, stock: s })
        }
        stockSummaryText =
          buildBudgetedHoldingSummary(
            stockSummaries.map((item) => ({
              key: item.code,
              code: item.code,
              name: item.name,
              weight:
                Number(item?.stock?.value) ||
                Number(item?.stock?.price || 0) * Number(item?.stock?.qty || 0),
              text: `${item.name}(${item.code})[${item.meta.industry || ''}/${item.meta.position || ''}]: ${item.summary}`,
            })),
            { maxChars: 3000, maxEntries: 5, joiner: '\n\n' }
          ).text || '目前沒有持股摘要。'
      }

      console.debug('[research] portfolio prompt ready', {
        mode,
        roundMode: portfolioRoundMode,
        stockSummaryChars: stockSummaryText.length,
        eventSummaryChars: evtSummary.length,
        analysisHistoryChars: histSummary.length,
        brainContextChars: brainCtx.length,
      })

      sendProgress(res, 'round', { round: 1, title: '個股快掃', done: true })

      // ── Round 2：系統診斷（由上往下，結合個股掃描結果）──
      const diag = await callClaude(
        `你是投資系統架構師。基於個股研究結果和完整系統資料，診斷這個交易者的投資系統。`,
        `${notesContext}

## 個股研究摘要（Round 1 結果）
${stockSummaryText}

## 策略大腦
${brainCtx}

## 事件預測紀錄
${evtSummary || '（無紀錄）'}

## 近期收盤分析
${histSummary || '（無紀錄）'}

═══ 預測校準要求（最優先完成）═══
上面的事件預測紀錄中，✓ 是正確的，✗ 是錯誤的。
請先計算準確率，並回答：
1. 哪類事件預測最差？為什麼？
2. 近期收盤分析中，AI 說「看好」的股票後來真的漲了嗎？用數字回答。
3. 這個交易者（以及你作為 AI 顧問）最容易犯的系統性錯誤是什麼？
不允許說「整體表現尚可」這類模糊評價。必須用具體數字說話。

═══ 系統診斷 ═══
請診斷這個投資系統：
1. **決策品質**：從事件預測命中率看，哪些類型的判斷最準？哪些最差？為什麼？
2. **策略一致性**：策略大腦的規則 vs 實際操作，有沒有言行不一致的地方？
3. **認知盲點**：從歷史分析看，這個交易者反覆忽略了什麼？
4. **資金效率**：資金配置是否合理？有沒有資金被困在低效益的部位？
5. **情緒模式**：從交易紀錄能推斷出什麼情緒傾向？（追高、恐慌出場、過度自信等）
6. **個股問題**：根據個股研究摘要，哪幾檔最需要立即行動？
7. **AI 顧問自我檢討**：如果你就是之前做出這些分析的 AI，你自己最大的盲點是什麼？`
      )

      sendProgress(res, 'round', { round: 2, title: '系統診斷', done: true })

      // ── Round 3：進化建議 + 組合調整（合併策略建議與系統改善）──
      const evolveAdvice = await callClaude(
        `你是投資系統優化顧問兼組合管理專家。基於個股研究和系統診斷，提出完整的改善方案。`,
        `${notesContext}\n\n個股研究摘要：\n${stockSummaryText}\n\n系統診斷結果：\n${diag}\n\n請提出：

## 一、組合層級建議
1. **組合健康度評分** (1-10)
2. **最需要行動的 3 檔**（結合個股研究的信心度和系統診斷的問題）
3. **產業配置調整**（目前配置 vs 建議配置）
4. **資金調度建議**（具體到哪檔減碼、哪檔加碼、金額比例）
5. **未來 1 個月最大風險**

## 二、系統改善建議
1. **策略大腦更新建議**：哪些規則要修改？要新增什麼？要刪除什麼過時規則？
2. **決策流程改善**：進場前多問什麼問題？出場常犯的錯怎麼防？
3. **事件追蹤優化**：目前追蹤夠不夠？漏掉哪些重要的觀察角度？
4. **下週具體行動清單**：按優先順序列出 5 個最應該做的事`
      )

      sendProgress(res, 'round', { round: 3, title: '進化建議', done: true })

      // ── Round 4：生成候選策略提案（JSON output）──
      const newBrainText = await callClaude(
        `你是台股策略大腦進化引擎。根據研究結果輸出純 JSON（不要 markdown code fence）。

重要限制：
- 新增 rules 最多 3 條，挑最有證據的
- 超過 3 條的放 candidateRules
- 不要跟現有規則重複

JSON 結構：
{
  "rules": [{"text":"規則","when":"情境","action":"動作","confidence":1-10,"evidenceCount":N,"source":"ai","status":"active"}],
  "candidateRules": [{"text":"待驗證","when":"情境","action":"動作","confidence":1-10,"status":"candidate"}],
  "lessons": [{"date":"日期","text":"教訓"}],
  "evolution": "一句話摘要"
}`,
        `個股研究：\n${stockSummaryText}\n\n系統診斷：\n${diag}\n\n進化建議：\n${evolveAdvice}\n\n現有策略大腦：\n${brainCtx}\n\n今天是 ${today}。整合以上資訊，保留有效舊規則，加入新的候選內容。`
      )

      let parsedBrain = null
      try {
        const clean = newBrainText.replace(/```json|```/g, '').trim()
        parsedBrain = JSON.parse(clean)

        // 自動截斷：AI 常生超過 3 條新規則，把超出的降級到 candidateRules
        if (parsedBrain && Array.isArray(parsedBrain.rules) && brain) {
          const currentTexts = [...(brain.rules || []), ...(brain.candidateRules || [])].map((r) =>
            String(r?.text || '').slice(0, 30)
          )
          const isNew = (rule) =>
            !currentTexts.some((t) => t && String(rule?.text || '').startsWith(t))
          const newRules = parsedBrain.rules.filter(isNew)
          if (newRules.length > 3) {
            const keep = newRules.slice(0, 3)
            const demote = newRules.slice(3).map((r) => ({ ...r, status: 'candidate' }))
            parsedBrain.rules = parsedBrain.rules.filter((r) => !isNew(r) || keep.includes(r))
            parsedBrain.candidateRules = [...(parsedBrain.candidateRules || []), ...demote]
          }
        }
      } catch (e) {
        /* 解析失敗就不更新 */
      }

      const proposalId = `brain-proposal-${Date.now()}`
      const brainProposal = buildBrainProposal({
        proposalId,
        parsedBrain,
        currentBrain: brain,
        today,
        mode,
        diagnostics: diag,
        advice: evolveAdvice,
      })
      const knowledgeProposal = buildKnowledgeEvolutionProposal({
        usageLog: knowledgeUsageLog,
        feedbackLog: knowledgeFeedbackLog,
      })

      if (persist && brainProposal) {
        await write(`${BRAIN_PROPOSAL_PREFIX}/${proposalId}.json`, brainProposal)
      }

      const reportCode = mode === 'portfolio' ? 'PORTFOLIO' : 'EVOLVE'
      const reportName = mode === 'portfolio' ? '全組合研究' : '全組合研究 + 系統進化'
      const reportKey = `research/${reportCode}/${Date.now()}.json`

      const report = {
        code: reportCode,
        name: reportName,
        date: today,
        timestamp: Date.now(),
        mode,
        roundMode: portfolioRoundMode,
        rounds: [
          {
            title: '個股快掃',
            content: stockSummaries
              .map((s) => `### ${s.name}(${s.code})\n${s.summary}`)
              .join('\n\n'),
          },
          { title: '系統診斷', content: diag },
          { title: '進化建議 + 組合調整', content: evolveAdvice },
          {
            title: '候選策略提案',
            content: brainProposal
              ? `📝 已生成候選策略提案（${brainProposal.status === 'candidate' ? '通過 gate，尚未自動套用' : '未通過 gate'}）\n\n**提案摘要：** ${brainProposal.summary || '—'}\n\n**Gate 結論：** ${brainProposal.evaluation?.summary || '—'}\n\n**新規則數：** ${brainProposal.metrics?.ruleCount || 0}\n**候選規則數：** ${brainProposal.metrics?.candidateRuleCount || 0}\n**累積教訓：** ${brainProposal.metrics?.lessonCount || 0}${
                  Array.isArray(brainProposal.evaluation?.issues) &&
                  brainProposal.evaluation.issues.length > 0
                    ? `\n\n**阻塞原因：** ${brainProposal.evaluation.issues.join('；')}`
                    : ''
                }`
              : '⚠️ 候選策略提案生成失敗，請手動檢查',
          },
          {
            title: '知識庫演化提案',
            content: formatKnowledgeProposalContent(knowledgeProposal),
          },
        ],
        stockSummaries,
        brainProposal,
        knowledgeProposal,
        proposalStatus: brainProposal?.status || 'failed',
      }
      if (persist) {
        writeLocal(reportKey, report)
        await updateResearchIndex(report)
      }
      if (persist && TOKEN) {
        try {
          await put(reportKey, JSON.stringify(report), {
            access: 'public',
            token: TOKEN,
            contentType: 'application/json',
          })
        } catch (err) {
          console.warn('[api/research] blob persist (portfolio) failed:', err.message || err)
        }
      }
      results.push(report)
    }

    if (results.length === 0) {
      console.warn('[research] no report generated', requestSummary)
      return res.status(422).json({
        error: '研究未產生結果',
        requestSummary,
      })
    }

    if (wantsStream) {
      sendProgress(res, 'done', { results })
      res.end()
      return
    }
    return res.status(200).json({ results })
  } catch (err) {
    if (wantsStream) {
      sendProgress(res, 'error', { error: err.message })
      res.end()
      return
    }
    return res.status(500).json({ error: '研究失敗', detail: err.message })
  }
}
