import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { INIT_HOLDINGS, STOCK_META } from '../seedData.js'
import { buildDailyAnalysisRequest } from './dailyAnalysisRuntime.js'
import { findHistoricalAnalogs } from './brainRuntime.js'

export const BACKTEST_DATES = [
  '2024-03-15',
  '2024-06-01',
  '2024-08-05',
  '2024-10-01',
  '2024-12-15',
  '2025-03-01',
  '2025-06-01',
  '2025-09-15',
  '2025-12-01',
  '2026-03-01',
]

const FINMIND_ENDPOINT = 'https://api.finmindtrade.com/api/v4/data'
const DEFAULT_EMPTY_BRAIN = {
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

function addDays(dateText, days) {
  const d = new Date(dateText)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function sum(values) {
  return values.reduce((acc, value) => acc + (Number(value) || 0), 0)
}

async function fetchFinMindRaw(dataset, code, startDate, endDate = '') {
  const params = new URLSearchParams({ dataset, data_id: String(code), start_date: startDate })
  const token = process.env.FINMIND_TOKEN || ''
  if (endDate) params.set('end_date', endDate)
  if (token) params.set('token', token)
  const response = await fetch(`${FINMIND_ENDPOINT}?${params.toString()}`, {
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`FinMind ${dataset} failed (${response.status})`)
  const json = await response.json()
  return Array.isArray(json?.data) ? json.data : []
}

function normalizeInstitutionalRows(rows = []) {
  return rows
    .map((row) => ({
      date: row.date,
      foreign: Number(row.buy_sell_balance || row.Foreign_Investor_buy_sell || 0),
      investmentTrust: Number(row.Investment_Trust_buy_sell || row.Investment_Trust || 0),
      dealer: Number(row.Dealer_self_buy_sell || row.Dealer_Hedging_buy_sell || row.Dealer || 0),
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

function normalizeMarginRows(rows = []) {
  return rows
    .map((row) => ({
      date: row.date,
      marginPurchase: Number(row.MarginPurchaseBuy || row.MarginPurchaseTodayBalance || 0),
      shortSale: Number(row.ShortSaleBuy || row.ShortSaleTodayBalance || 0),
      marginBalance: Number(row.MarginPurchaseTodayBalance || 0),
      shortBalance: Number(row.ShortSaleTodayBalance || 0),
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

function normalizeValuationRows(rows = []) {
  return rows
    .map((row) => ({
      date: row.date,
      per: Number(row.PER || row.per || 0),
      pbr: Number(row.PBR || row.pbr || 0),
      dividendYield: Number(row.dividend_yield || row.dividendYield || 0),
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

function normalizeRevenueRows(rows = []) {
  return rows
    .map((row) => ({
      date: row.date,
      revenueMonth: `${row.revenue_year || ''}/${String(row.revenue_month || '').padStart(2, '0')}`,
      revenue: Number(row.revenue || 0),
      revenueYoY: Number(row.revenue_year_growth_rate || row.revenueYoY || 0),
      revenueMoM: Number(row.revenue_month_growth_rate || row.revenueMoM || 0),
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

function chooseHoldingPeriod(meta = {}) {
  const period = String(meta?.period || '')
  const strategy = String(meta?.strategy || '')
  if (period.includes('短') || strategy.includes('權證') || strategy.includes('事件驅動')) {
    return { label: 'short', horizonDays: 7 }
  }
  if (period.includes('中長') || period.includes('長') || meta?.position === '核心') {
    return { label: 'long', horizonDays: 90 }
  }
  return { label: 'mid', horizonDays: 30 }
}

function loadStrategyBrainSnapshot() {
  const path = join(process.cwd(), 'data', 'strategy-brain.json')
  if (!existsSync(path)) return DEFAULT_EMPTY_BRAIN
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return DEFAULT_EMPTY_BRAIN
  }
}

export async function buildBacktestDossier(code, date) {
  const stockMeta = STOCK_META?.[code] || STOCK_META?.[String(code)] || {}
  const start90 = addDays(date, -90)
  const endDate = date
  const [valuationRaw, institutionalRaw, marginRaw, revenueRaw] = await Promise.all([
    fetchFinMindRaw('TaiwanStockPER', code, start90, endDate),
    fetchFinMindRaw('TaiwanStockInstitutionalInvestorsBuySell', code, addDays(date, -20), endDate),
    fetchFinMindRaw('TaiwanStockMarginPurchaseShortSale', code, addDays(date, -20), endDate),
    fetchFinMindRaw('TaiwanStockMonthRevenue', code, addDays(date, -370), endDate),
  ])

  const valuation = normalizeValuationRows(valuationRaw)
  const institutional = normalizeInstitutionalRows(institutionalRaw)
  const margin = normalizeMarginRows(marginRaw)
  const revenue = normalizeRevenueRows(revenueRaw)
  const latestRevenue = revenue[0] || null
  const latestValuation = valuation[0] || null
  const latestMargin = margin[0] || null
  const last5Institutional = institutional.slice(0, 5)

  return {
    code: String(code),
    name: stockMeta?.underlying || stockMeta?.name || String(code),
    meta: stockMeta,
    valuation,
    institutional,
    margin,
    revenue,
    signals: {
      revenueYoY: latestRevenue?.revenueYoY ?? null,
      revenueMoM: latestRevenue?.revenueMoM ?? null,
      per: latestValuation?.per ?? null,
      pbr: latestValuation?.pbr ?? null,
      institutional5d: {
        foreign: sum(last5Institutional.map((row) => row.foreign)),
        investmentTrust: sum(last5Institutional.map((row) => row.investmentTrust)),
        dealer: sum(last5Institutional.map((row) => row.dealer)),
      },
      marginDelta:
        margin.length >= 2
          ? (Number(latestMargin?.marginBalance) || 0) - (Number(margin[1]?.marginBalance) || 0)
          : null,
    },
    horizon: chooseHoldingPeriod(stockMeta),
    analysisDate: date,
  }
}

export function runBacktestAnalysis(dossier, date) {
  const brain = loadStrategyBrainSnapshot()
  const analogs = findHistoricalAnalogs(
    { code: dossier.code, name: dossier.name, sector: dossier.meta?.industry },
    {
      title: `${dossier.meta?.strategy || ''} ${dossier.meta?.industry || ''}`,
      thesis: `營收YoY ${dossier.signals.revenueYoY ?? 'NA'} / 外資5日 ${dossier.signals.institutional5d.foreign}`,
      outcomePattern:
        (dossier.signals.revenueYoY || 0) > 15 || (dossier.signals.institutional5d.foreign || 0) > 0
          ? 'positive'
          : 'negative',
    }
  )

  let score = 0
  const reasons = []
  if ((dossier.signals.revenueYoY || 0) >= 20) {
    score += 2
    reasons.push('月營收 YoY 強勁')
  } else if ((dossier.signals.revenueYoY || 0) < 0) {
    score -= 2
    reasons.push('月營收 YoY 轉弱')
  }
  if ((dossier.signals.institutional5d.foreign || 0) > 0) {
    score += 1
    reasons.push('外資近5日偏多')
  } else if ((dossier.signals.institutional5d.foreign || 0) < 0) {
    score -= 1
    reasons.push('外資近5日偏空')
  }
  if ((dossier.signals.institutional5d.investmentTrust || 0) > 0) {
    score += 1
    reasons.push('投信近5日偏多')
  }
  if ((dossier.signals.marginDelta || 0) > 0 && (dossier.signals.revenueYoY || 0) < 0) {
    score -= 1
    reasons.push('融資增加但基本面未跟上')
  }
  if ((dossier.signals.per || 0) > 25) {
    score -= 1
    reasons.push('PER 偏高')
  } else if ((dossier.signals.per || 0) > 0 && (dossier.signals.per || 0) < 15) {
    score += 1
    reasons.push('PER 合理偏低')
  }
  if ((analogs || []).some((item) => item.verdict === 'supported')) {
    score += 1
    reasons.push('歷史類比偏正向')
  }
  if ((brain.rules || []).length > 0) {
    score += Math.min(
      2,
      (brain.rules || []).filter((rule) => {
        const text = String(rule?.text || '')
        return [dossier.meta?.strategy, dossier.meta?.industry, '月營收', '法人', '停損'].some(
          (token) => token && text.includes(token)
        )
      }).length
    )
    if (score > 0) reasons.push('現有策略腦規則有對應')
  }

  const verdict = score >= 3 ? '看多' : score <= -2 ? '看空' : '觀望'
  const action = verdict === '看多' ? '買進/續抱' : verdict === '看空' ? '減碼/避開' : '等待確認'
  const confidence = Math.max(0.35, Math.min(0.9, 0.55 + score * 0.08))

  const promptPacket = buildDailyAnalysisRequest({
    today: date,
    marketContext: `回測模式，不呼叫 AI；僅根據歷史資料與規則比對打分。`,
    notesContext: 'backtest',
    brainContext: `active rules: ${(brain.rules || []).length}`,
    holdingSummary: `${dossier.name}(${dossier.code}) strategy=${dossier.meta?.strategy || '未分類'} industry=${dossier.meta?.industry || '未分類'}`,
    coverageContext: reasons.join('；'),
    eventSummary: `歷史類比 ${analogs.length} 筆`,
    taiwanMarketSignals: `營收YoY=${dossier.signals.revenueYoY ?? 'NA'}；外資5日=${dossier.signals.institutional5d.foreign}；投信5日=${dossier.signals.institutional5d.investmentTrust}；融資變化=${dossier.signals.marginDelta ?? 'NA'}；PER=${dossier.signals.per ?? 'NA'}`,
    historicalAnalogs:
      analogs.map((item, index) => `${index + 1}. ${item.name}｜${item.thesis}`).join('\n') || '無',
  })

  return {
    verdict,
    confidence: Math.round(confidence * 100) / 100,
    action,
    score,
    reasons,
    analogs,
    promptPacket,
    matchedRules: (brain.rules || []).map((rule) => rule.id || rule.text).slice(0, 5),
  }
}

export async function evaluateResult(code, analysisDate, actualDate) {
  const rows = await fetchFinMindRaw('TaiwanStockPrice', code, analysisDate, actualDate)
  const sorted = [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date)))
  if (sorted.length < 2) {
    return {
      startPrice: null,
      endPrice: null,
      pctChange: null,
      actualDirection: 'unknown',
      correct: false,
    }
  }
  const startPrice = Number(sorted[0]?.close || sorted[0]?.close_price || 0)
  const endPrice = Number(
    sorted[sorted.length - 1]?.close || sorted[sorted.length - 1]?.close_price || 0
  )
  const pctChange =
    startPrice > 0 ? Math.round((endPrice / startPrice - 1) * 100 * 100) / 100 : null
  const actualDirection =
    pctChange == null ? 'unknown' : pctChange > 3 ? 'up' : pctChange < -3 ? 'down' : 'flat'
  return { startPrice, endPrice, pctChange, actualDirection, correct: false }
}

export function comparePrediction(analysis, evaluation) {
  const predicted =
    analysis.verdict === '看多' ? 'up' : analysis.verdict === '看空' ? 'down' : 'flat'
  const correct = predicted === evaluation.actualDirection
  return { predicted, correct }
}

export function feedbackToKnowledge(results = []) {
  const ruleAdjustments = new Map()
  ;(Array.isArray(results) ? results : []).forEach((result) => {
    const delta = result.correct ? 0.02 : -0.03
    ;(result.matchedRules || []).forEach((ruleKey) => {
      ruleAdjustments.set(
        ruleKey,
        Math.round(((ruleAdjustments.get(ruleKey) || 0) + delta) * 100) / 100
      )
    })
  })
  return {
    updatedAt: new Date().toISOString(),
    adjustments: Array.from(ruleAdjustments.entries()).map(([ruleKey, delta]) => ({
      ruleKey,
      delta,
    })),
  }
}

export async function runBacktestRound({ code, date }) {
  const dossier = await buildBacktestDossier(code, date)
  const analysis = runBacktestAnalysis(dossier, date)
  const actualDate = addDays(date, dossier.horizon.horizonDays)
  const evaluation = await evaluateResult(code, date, actualDate)
  const { predicted, correct } = comparePrediction(analysis, evaluation)
  return {
    code,
    date,
    horizon: dossier.horizon,
    dossier,
    analysis,
    evaluation: { ...evaluation, actualDate },
    predicted,
    correct,
  }
}

export async function runBacktestBatch({ date, code = 'all', rounds = 10 } = {}) {
  const dates = date ? [date] : BACKTEST_DATES.slice(0, rounds)
  const codes =
    code === 'all'
      ? INIT_HOLDINGS.map((item) => String(item.code)).slice(0, Math.max(1, Math.min(rounds, 10)))
      : [String(code)]

  const results = []
  for (const roundDate of dates.slice(0, rounds)) {
    for (const currentCode of codes) {
      try {
        results.push(await runBacktestRound({ code: currentCode, date: roundDate }))
      } catch (error) {
        results.push({
          code: currentCode,
          date: roundDate,
          error: error.message,
          correct: false,
          matchedRules: [],
        })
      }
    }
  }

  const completed = results.filter((item) => !item.error)
  const correctCount = completed.filter((item) => item.correct).length
  return {
    config: { date: date || null, code, rounds },
    total: results.length,
    completed: completed.length,
    correctCount,
    accuracy:
      completed.length > 0 ? Math.round((correctCount / completed.length) * 10000) / 100 : 0,
    feedback: feedbackToKnowledge(
      completed.map((item) => ({ ...item, matchedRules: item.analysis?.matchedRules || [] }))
    ),
    results,
  }
}
