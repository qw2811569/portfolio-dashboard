import { mkdir, readFile, writeFile } from 'fs/promises'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { normalizeFinancialStatementRows } from '../src/lib/finmindPeriodUtils.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const KB_DIR = path.join(ROOT, 'src/lib/knowledge-base')
const REPORT_PATH = path.join(ROOT, 'docs/status/kb-availability-2026-04-18.md')
const FINMIND_BASE = 'https://api.finmindtrade.com/api/v4/data'
const KB_FILES = [
  'chip-analysis.json',
  'fundamental-analysis.json',
  'industry-trends.json',
  'news-correlation.json',
  'risk-management.json',
  'strategy-cases.json',
  'technical-analysis.json',
]

const REQUIREMENT_ORDER = [
  'institutional',
  'margin',
  'valuation',
  'revenue',
  'financials',
  'balanceSheet',
  'cashFlow',
  'dividend',
  'dividendResult',
  'shareholding',
  'news',
]

function readEnvToken() {
  const fromProcess = String(process.env.FINMIND_TOKEN || '').trim()
  if (fromProcess) return { token: fromProcess, source: 'process.env' }

  for (const name of ['.env.local', '.env']) {
    const fullPath = path.join(ROOT, name)
    if (!existsSync(fullPath)) continue
    const text = requireEnvFile(fullPath)
    const token = text.FINMIND_TOKEN
    if (token) return { token, source: name }
  }
  return { token: '', source: 'missing' }
}

function requireEnvFile(fullPath) {
  return parseEnvText(readFileSync(fullPath, 'utf8'))
}

function parseEnvText(text) {
  const result = {}
  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim().replace(/^"|"$/g, '')
    result[key] = value
  }
  return result
}

function textBlob(rule) {
  return [
    rule.title,
    rule.fact,
    rule.interpretation,
    rule.action,
    ...(Array.isArray(rule.tags) ? rule.tags : []),
  ]
    .filter(Boolean)
    .join(' ')
}

function inferRequiresData(rule, category) {
  const text = textBlob(rule)
  const requirements = []
  const seen = new Set()

  const add = (dataset, periodType, availableWhen) => {
    const key = `${dataset}:${periodType}`
    if (seen.has(key)) return
    seen.add(key)
    requirements.push({ dataset, periodType, availableWhen })
  }

  const has = (pattern) => pattern.test(text)

  const mentionsInstitutional = /外資|投信|自營|法人|買超|賣超|籌碼/.test(text)
  const mentionsMargin = /融資|融券|券資|信用交易|維持率|斷頭|槓桿/.test(text)
  const mentionsShareholding = /持股比|股權|集保|大戶|小股東|外資持股/.test(text)
  const mentionsValuation = /本益比|PER|PBR|股價淨值比|殖利率|估值/.test(text)
  const mentionsRevenue = /營收|YoY|MoM|月增|年增/.test(text)
  const mentionsQuarterlyRevenue = /Q[1-4]|單季|季度|季增|H1|H2|半年/.test(text)
  const mentionsFinancials =
    /EPS|毛利|營益|淨利|稅後|稅前|ROE|ROA|獲利|財報|應計|現金轉換|毛利率|營益率/.test(text)
  const mentionsBalanceSheet =
    /負債|資產|股東權益|淨值|流動比|速動比|存貨|應收帳款|應付帳款/.test(text)
  const mentionsCashFlow = /現金流|自由現金流|CAPEX|資本支出|折舊|FCF/.test(text)
  const mentionsDividend = /股利|配息|配股|填息|除息|除權/.test(text)
  const mentionsNews = /新聞|法說|公告|題材|消息|媒體|記者會/.test(text)

  if (category === 'chip-analysis' || mentionsInstitutional) {
    add('institutional', 'daily-5d-trend', 'T+0 收盤後')
  }
  if (mentionsMargin) {
    add('margin', 'daily-balance', 'T+0 收盤後')
  }
  if (mentionsShareholding) {
    add('shareholding', 'daily-ratio', '日更 / 申報後')
  }
  if (mentionsValuation) {
    add('valuation', 'daily-history', 'T+0 收盤後')
  }
  if (mentionsRevenue) {
    add(
      'revenue',
      mentionsQuarterlyRevenue ? 'quarterly-sum-from-monthly' : 'monthly-announcement',
      '每月營收公告後'
    )
  }
  if (category === 'fundamental-analysis' || mentionsFinancials) {
    add('financials', 'quarterly-standalone', '季報公告後')
  }
  if (mentionsBalanceSheet) {
    add('balanceSheet', 'quarterly-balance', '季報公告後')
  }
  if (mentionsCashFlow) {
    add('cashFlow', 'quarterly-cashflow', '季報公告後')
  }
  if (mentionsDividend) {
    add('dividend', 'annual-history', '董事會 / 股東會後')
    if (/填息|除息|除權/.test(text)) {
      add('dividendResult', 'ex-date-result', '除權息交易後')
    }
  }
  if (category === 'news-correlation' || mentionsNews) {
    add('news', 'rolling-14d', '盤中 / 日更')
  }

  return requirements.sort((left, right) => {
    const datasetDiff =
      REQUIREMENT_ORDER.indexOf(left.dataset) - REQUIREMENT_ORDER.indexOf(right.dataset)
    if (datasetDiff !== 0) return datasetDiff
    return left.periodType.localeCompare(right.periodType)
  })
}

function computeStatusFromRequirements(requirements, probes) {
  if (!requirements.length) {
    return {
      status: 'available',
      reason: '不依賴 FinMind gated dataset',
    }
  }

  let hasCallMethodError = false
  const notes = []

  for (const requirement of requirements) {
    const probeKey = `${requirement.dataset}:${requirement.periodType}`
    const datasetProbe = probes[probeKey] || probes[`${requirement.dataset}:*`] || null
    if (!datasetProbe || datasetProbe.available !== true) {
      return {
        status: 'data-missing-from-finmind',
        reason: `${requirement.dataset} / ${requirement.periodType} 無法從 FinMind 取得`,
      }
    }
    if (datasetProbe.callMethodError) {
      hasCallMethodError = true
      notes.push(`${requirement.dataset}:${requirement.periodType}`)
    }
  }

  return hasCallMethodError
    ? {
        status: 'call-method-error',
        reason: `上游有資料，但 repo 需做 ${notes.join(', ')} 修正才能正確使用`,
      }
    : {
        status: 'available',
        reason: '直接可用',
      }
}

function pivotStatementRows(rows = []) {
  const byDate = new Map()
  for (const row of rows) {
    if (!row?.date || !row?.type) continue
    const current = byDate.get(row.date) || { date: row.date }
    current[row.type] = Number(row.value)
    byDate.set(row.date, current)
  }
  return [...byDate.values()].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
}

async function queryFinMind(token, dataset, params = {}) {
  const searchParams = new URLSearchParams({ dataset })
  for (const [key, value] of Object.entries(params)) {
    if (value == null || String(value).trim() === '') continue
    searchParams.set(key, String(value))
  }

  const response = await fetch(`${FINMIND_BASE}?${searchParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'portfolio-dashboard/kb-audit',
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${dataset} failed (${response.status}): ${body.slice(0, 200)}`)
  }

  const payload = await response.json()
  if (Number(payload.status) !== 200 && payload.msg !== 'success') {
    throw new Error(`${dataset} payload error: ${payload.msg || payload.status}`)
  }
  return Array.isArray(payload.data) ? payload.data : []
}

async function buildProbes(token) {
  const [
    institutionalRows,
    marginRows,
    valuationRows,
    revenueRows6862,
    financialRows6862,
    balanceSheetRows,
    cashFlowRows,
    dividendRows,
    dividendResultRows,
    shareholdingRows,
    newsRows,
  ] = await Promise.all([
    queryFinMind(token, 'TaiwanStockInstitutionalInvestorsBuySell', {
      data_id: '6862',
      start_date: '2026-04-01',
    }),
    queryFinMind(token, 'TaiwanStockMarginPurchaseShortSale', {
      data_id: '2308',
      start_date: '2026-03-01',
    }),
    queryFinMind(token, 'TaiwanStockPER', {
      data_id: '2308',
      start_date: '2026-01-01',
    }),
    queryFinMind(token, 'TaiwanStockMonthRevenue', {
      data_id: '6862',
      start_date: '2025-01-01',
    }),
    queryFinMind(token, 'TaiwanStockFinancialStatements', {
      data_id: '6862',
      start_date: '2025-01-01',
    }),
    queryFinMind(token, 'TaiwanStockBalanceSheet', {
      data_id: '2308',
      start_date: '2025-01-01',
    }),
    queryFinMind(token, 'TaiwanStockCashFlowsStatement', {
      data_id: '2308',
      start_date: '2025-01-01',
    }),
    queryFinMind(token, 'TaiwanStockDividend', {
      data_id: '2308',
      start_date: '2024-01-01',
    }),
    queryFinMind(token, 'TaiwanStockDividendResult', {
      data_id: '2308',
      start_date: '2024-01-01',
    }),
    queryFinMind(token, 'TaiwanStockShareholding', {
      data_id: '2308',
      start_date: '2026-01-01',
    }),
    queryFinMind(token, 'TaiwanStockNews', {
      data_id: '2308',
      start_date: '2024-01-01',
    }),
  ])

  const normalizedFinancials6862 = normalizeFinancialStatementRows(
    pivotStatementRows(financialRows6862),
    revenueRows6862
  )
  const q2Financials6862 = normalizedFinancials6862.find((row) => row.quarter === '2025Q2') || null
  const q2Revenue6862 = revenueRows6862
    .filter((row) => Number(row.revenue_year) === 2025 && [4, 5, 6].includes(Number(row.revenue_month)))
    .reduce((sum, row) => sum + Number(row.revenue || 0), 0)

  return {
    'institutional:daily-5d-trend': {
      available: institutionalRows.length > 0,
      callMethodError: institutionalRows.some((row) => /Foreign_Dealer_Self|Dealer_Hedging/.test(String(row.name || ''))),
      evidence: `6862 自 2026-04-01 起共 ${institutionalRows.length} 筆，包含 English participant labels`,
    },
    'margin:daily-balance': {
      available: marginRows.length > 0,
      callMethodError: false,
      evidence: `2308 自 2026-03-01 起共 ${marginRows.length} 筆`,
    },
    'valuation:daily-history': {
      available: valuationRows.length > 0,
      callMethodError: false,
      evidence: `2308 自 2026-01-01 起共 ${valuationRows.length} 筆`,
    },
    'revenue:monthly-announcement': {
      available: revenueRows6862.length > 0,
      callMethodError: false,
      evidence: `6862 自 2025-01-01 起共 ${revenueRows6862.length} 筆月營收`,
    },
    'revenue:quarterly-sum-from-monthly': {
      available: revenueRows6862.length > 0 && q2Revenue6862 > 0,
      callMethodError: true,
      evidence: `6862 2025Q2 需用 4-6 月營收加總 ≈ ${Math.round(q2Revenue6862).toLocaleString('en-US')}`,
    },
    'financials:quarterly-standalone': {
      available: normalizedFinancials6862.length > 0,
      callMethodError: true,
      evidence: q2Financials6862
        ? `6862 2025Q2 = ${q2Financials6862.statementPeriodMode}; warnings=${q2Financials6862.statementWarnings.join(',') || 'none'}`
        : `6862 normalized financial rows = ${normalizedFinancials6862.length}`,
    },
    'balanceSheet:quarterly-balance': {
      available: balanceSheetRows.length > 0,
      callMethodError: false,
      evidence: `2308 balance sheet raw rows = ${balanceSheetRows.length}`,
    },
    'cashFlow:quarterly-cashflow': {
      available: cashFlowRows.length > 0,
      callMethodError: false,
      evidence: `2308 cash flow raw rows = ${cashFlowRows.length}`,
    },
    'dividend:annual-history': {
      available: dividendRows.length > 0,
      callMethodError: false,
      evidence: `2308 dividend rows = ${dividendRows.length}`,
    },
    'dividendResult:ex-date-result': {
      available: dividendResultRows.length > 0,
      callMethodError: false,
      evidence: `2308 dividend result rows = ${dividendResultRows.length}`,
    },
    'shareholding:daily-ratio': {
      available: shareholdingRows.length > 0,
      callMethodError: false,
      evidence: `2308 shareholding rows = ${shareholdingRows.length}`,
    },
    'news:rolling-14d': {
      available: newsRows.length > 0,
      callMethodError: false,
      evidence: `2308 news rows = ${newsRows.length}`,
    },
  }
}

async function loadCategory(filename) {
  const fullPath = path.join(KB_DIR, filename)
  const raw = await readFile(fullPath, 'utf8')
  const parsed = JSON.parse(raw)
  return { fullPath, parsed }
}

async function syncKnowledgeRequiresData() {
  const synced = []
  for (const filename of KB_FILES) {
    const { fullPath, parsed } = await loadCategory(filename)
    const nextItems = (parsed.items || []).map((item) => ({
      ...item,
      requiresData: inferRequiresData(item, parsed.category),
    }))

    const nextDoc = {
      ...parsed,
      metadata: {
        ...parsed.metadata,
        lastUpdated: '2026-04-18T00:00:00+08:00',
      },
      items: nextItems,
    }

    await writeFile(fullPath, `${JSON.stringify(nextDoc, null, 2)}\n`, 'utf8')
    synced.push({
      category: parsed.category,
      filename,
      count: nextItems.length,
    })
  }
  return synced
}

function summarizeBy(items, key) {
  const map = new Map()
  for (const item of items) {
    const value = key(item)
    map.set(value, (map.get(value) || 0) + 1)
  }
  return [...map.entries()].sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1]
    return String(left[0]).localeCompare(String(right[0]))
  })
}

function formatTimestamp() {
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Taipei',
  }).format(new Date())
}

async function main() {
  const { token, source } = readEnvToken()
  if (!token) {
    throw new Error('FINMIND_TOKEN missing in process.env/.env.local/.env')
  }

  const synced = await syncKnowledgeRequiresData()
  const probes = await buildProbes(token)

  const auditedRules = []
  for (const filename of KB_FILES) {
    const { parsed } = await loadCategory(filename)
    for (const item of parsed.items || []) {
      const requirements = Array.isArray(item.requiresData) ? item.requiresData : []
      const { status, reason } = computeStatusFromRequirements(requirements, probes)
      auditedRules.push({
        id: item.id,
        title: item.title,
        category: parsed.category,
        status,
        reason,
        requiresData: requirements,
      })
    }
  }

  const totalRules = auditedRules.length
  const statusSummary = summarizeBy(auditedRules, (item) => item.status)
  const categorySummary = summarizeBy(auditedRules, (item) => `${item.category}:${item.status}`)
  const requirementSummary = summarizeBy(
    auditedRules.flatMap((item) => item.requiresData.map((requirement) => `${requirement.dataset}:${requirement.periodType}`)),
    (value) => value
  )

  const probeTable = Object.entries(probes).sort((left, right) => left[0].localeCompare(right[0]))

  const reportLines = [
    '# KB Availability Audit · 2026-04-18',
    '',
    `- Generated at: ${formatTimestamp()} (Asia/Taipei)`,
    `- FINMIND_TOKEN source: \`${source}\``,
    `- KB files synced with \`requiresData\`: ${synced.map((item) => `${item.category}(${item.count})`).join(', ')}`,
    `- Rules audited: ${totalRules}`,
    '',
    '## Summary',
    '',
    '| status | count |',
    '| --- | ---: |',
    ...statusSummary.map(([status, count]) => `| ${status} | ${count} |`),
    '',
    '## Probe Evidence',
    '',
    '| probe | available | call-method-error | evidence |',
    '| --- | --- | --- | --- |',
    ...probeTable.map(
      ([probe, detail]) =>
        `| ${probe} | ${detail.available ? 'yes' : 'no'} | ${detail.callMethodError ? 'yes' : 'no'} | ${detail.evidence} |`
    ),
    '',
    '## Category × Status',
    '',
    '| category:status | count |',
    '| --- | ---: |',
    ...categorySummary.map(([label, count]) => `| ${label} | ${count} |`),
    '',
    '## Requirement Footprint',
    '',
    '| requirement | count |',
    '| --- | ---: |',
    ...requirementSummary.map(([label, count]) => `| ${label} | ${count} |`),
    '',
    '## Representative Call-Method Errors',
    '',
    ...auditedRules
      .filter((item) => item.status === 'call-method-error')
      .slice(0, 12)
      .map(
        (item) =>
          `- ${item.id} · ${item.title} — ${item.requiresData
            .map((requirement) => `${requirement.dataset}/${requirement.periodType}`)
            .join(', ')} · ${item.reason}`
      ),
    '',
    '## Representative True Missing',
    '',
    ...(auditedRules.some((item) => item.status === 'data-missing-from-finmind')
      ? auditedRules
          .filter((item) => item.status === 'data-missing-from-finmind')
          .slice(0, 12)
          .map(
            (item) =>
              `- ${item.id} · ${item.title} — ${item.requiresData
                .map((requirement) => `${requirement.dataset}/${requirement.periodType}`)
                .join(', ')}`
          )
      : ['- None in this paid-token probe set; current gaps are dominated by repo-side call method / interpretation issues.']),
    '',
    '## Notes',
    '',
    '- `call-method-error` = FinMind paid token can return data, but repo-side dataset selection / period semantics / participant label mapping must be corrected to use it safely.',
    '- `available` = current paid-token probe returned usable data without extra repair logic.',
    '- `data-missing-from-finmind` = probe still failed or returned no usable rows.',
    '- Revenue quarter audit follows the corrected rule: `2025Q2` means April+May+June month revenue sum, not a half-year cumulative label.',
  ]

  await mkdir(path.dirname(REPORT_PATH), { recursive: true })
  await writeFile(REPORT_PATH, `${reportLines.join('\n')}\n`, 'utf8')

  const statusObject = Object.fromEntries(statusSummary)
  console.log(
    JSON.stringify(
      {
        reportPath: path.relative(ROOT, REPORT_PATH),
        totalRules,
        statusSummary: statusObject,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error.message || error)
  process.exitCode = 1
})
