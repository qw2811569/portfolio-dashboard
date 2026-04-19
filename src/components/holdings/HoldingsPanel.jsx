import { createElement as h } from 'react'
import { C, alpha } from '../../theme.js'
import { IND_COLOR, STOCK_META } from '../../seedData.js'
import { useTrackedStocksSyncStatus } from '../../hooks/useTrackedStocksSyncStatus.js'
import { Card, OperatingContextCard } from '../common'
import { getHoldingMarketValue, getHoldingReturnPct } from '../../lib/holdings.js'
import Md from '../Md.jsx'
import HoldingsRing from '../overview/HoldingsRing.jsx'

const lbl = {
  fontSize: 10,
  color: C.textMute,
  letterSpacing: '0.06em',
  fontWeight: 600,
  marginBottom: 5,
}
const metricCard = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: '8px 11px',
  boxShadow: `${C.insetLine}, ${C.shadow}`,
}

const trackedSyncTone = {
  fresh: {
    color: C.textSec,
    border: alpha(C.olive, '30'),
    background: alpha(C.olive, '10'),
  },
  stale: {
    color: C.textSec,
    border: alpha(C.amber, '30'),
    background: alpha(C.amber, '12'),
  },
  missing: {
    color: C.textMute,
    border: alpha(C.textMute, '24'),
    background: alpha(C.textMute, '10'),
  },
  failed: {
    color: C.down,
    border: alpha(C.down, '30'),
    background: alpha(C.down, '10'),
  },
}

/**
 * Holdings Summary Metrics
 */
export function HoldingsSummary({ holdings, totalVal, totalCost, todayTotalPnl = 0 }) {
  const todayPnlColor = todayTotalPnl > 0 ? C.text : todayTotalPnl < 0 ? C.down : C.textSec
  const todayPnlText =
    todayTotalPnl > 0
      ? `+${todayTotalPnl.toLocaleString()}`
      : todayTotalPnl < 0
        ? todayTotalPnl.toLocaleString()
        : '0'

  const metrics = [
    ['總成本', totalCost.toLocaleString(), C.textSec],
    ['總市值', totalVal.toLocaleString(), C.text],
    ['持股數', `${holdings.length}檔`, C.lavender],
    ['今日損益', todayPnlText, todayPnlColor],
  ]

  return h(
    'div',
    {
      style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 8 },
    },
    metrics.map(([label, value, color]) =>
      h(
        'div',
        { key: label, className: 'ui-card', style: metricCard },
        h('div', { style: { fontSize: 9, color: C.textMute, letterSpacing: '0.08em' } }, label),
        h(
          'div',
          {
            className: 'tn',
            style: {
              fontSize: 14,
              fontWeight: 600,
              color: label === '總市值' ? C.text : label === '持股數' ? C.textSec : color,
              marginTop: 2,
            },
          },
          value
        )
      )
    )
  )
}

/**
 * Holdings Integrity Warning
 */
export function HoldingsIntegrityWarning({ issues }) {
  if (!issues || issues.length === 0) return null

  return h(
    'div',
    {
      style: {
        ...metricCard,
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(C.amber, '40')}`,
        padding: '8px 10px',
        fontSize: 10,
        color: C.textSec,
        lineHeight: 1.7,
      },
    },
    `有 ${issues.length} 檔現在抓不到價格，市值會先少一塊： `,
    issues
      .slice(0, 5)
      .map((item) => `${item.name || item.code}(${item.code})`)
      .join('、'),
    issues.length > 5 ? '…' : '',
    '。先按一次「收盤價」重抓；如果還在，就表示這幾檔要手動補資料。'
  )
}

function TrackedStocksSyncBadge({ portfolioId = '' }) {
  const { badge } = useTrackedStocksSyncStatus(portfolioId)
  if (!badge) return null

  const tone = trackedSyncTone[badge.status] || trackedSyncTone.missing

  return h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        marginTop: 6,
      },
    },
    h(
      'span',
      {
        'data-testid': 'tracked-stocks-sync-badge',
        title: badge.title,
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: 999,
          padding: '4px 9px',
          fontSize: 10,
          lineHeight: 1.2,
          fontWeight: 700,
          letterSpacing: '0.01em',
          border: `1px solid ${tone.border}`,
          background: tone.background,
          color: tone.color,
        },
      },
      badge.label
    )
  )
}

/**
 * Portfolio Health Check
 */
export function PortfolioHealthCheck({ holdings }) {
  if (!holdings || holdings.length === 0) return null

  // Industry distribution
  const indMap = {}
  holdings.forEach((h) => {
    const m = STOCK_META[h.code]
    if (!m) return
    indMap[m.industry] = (indMap[m.industry] || 0) + getHoldingMarketValue(h)
  })
  const indArr = Object.entries(indMap).sort((a, b) => b[1] - a[1])
  const indTotal = indArr.reduce((s, x) => s + x[1], 0) || 1

  // Strategy distribution
  const stratMap = {}
  holdings.forEach((h) => {
    const m = STOCK_META[h.code]
    if (!m) return
    stratMap[m.strategy] = (stratMap[m.strategy] || 0) + 1
  })

  // Period distribution
  const periodMap = {}
  holdings.forEach((h) => {
    const m = STOCK_META[h.code]
    if (!m) return
    periodMap[m.period] = (periodMap[m.period] || 0) + 1
  })

  // Position distribution
  const posMap = {}
  holdings.forEach((h) => {
    const m = STOCK_META[h.code]
    if (!m) return
    posMap[m.position] = (posMap[m.position] || 0) + getHoldingMarketValue(h)
  })

  // Industry concentration warnings
  const warnings = indArr.filter(([ind, val]) => {
    const count = holdings.filter((h) => STOCK_META[h.code]?.industry === ind).length
    return count >= 3 || val / indTotal > 0.25
  })

  return h(
    Card,
    { style: { marginBottom: 8 } },
    h('div', { style: lbl }, '投組健檢'),

    // Industry bar
    h(
      'div',
      {
        style: {
          display: 'flex',
          borderRadius: 4,
          overflow: 'hidden',
          height: 6,
          marginBottom: 8,
        },
      },
      indArr.map(([ind, val]) =>
        h('div', {
          key: ind,
          style: {
            width: `${(val / indTotal) * 100}%`,
            height: '100%',
            background: IND_COLOR[ind] || C.textMute,
          },
        })
      )
    ),

    // Industry labels
    h(
      'div',
      { style: { display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 } },
      indArr.map(([ind, val]) => {
        const pct = ((val / indTotal) * 100).toFixed(0)
        const count = holdings.filter((h) => STOCK_META[h.code]?.industry === ind).length
        const color = IND_COLOR[ind] || C.textMute
        return h(
          'span',
          {
            key: ind,
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              padding: '3px 8px',
              borderRadius: 6,
              background: C.subtle,
              border: `1px solid ${C.border}`,
              color: C.textSec,
            },
          },
          h('span', {
            style: { width: 6, height: 6, borderRadius: 3, background: color, flexShrink: 0 },
          }),
          `${ind} ${count}檔 ${pct}%`
        )
      })
    ),

    // Warnings
    warnings.length > 0 &&
      h(
        'div',
        {
          style: {
            background: C.amberBg,
            border: `1px solid ${alpha(C.amber, '20')}`,
            borderRadius: 6,
            padding: '6px 10px',
            marginBottom: 8,
            fontSize: 10,
            color: C.textSec,
            lineHeight: 1.6,
          },
        },
        '⚠ 產業集中：',
        warnings
          .map(([ind]) => {
            const count = holdings.filter((h) => STOCK_META[h.code]?.industry === ind).length
            return `${ind}(${count}檔)`
          })
          .join('、'),
        warnings.some(([, val]) => val / indTotal > 0.3) && ' — 建議分散風險'
      ),

    // Three column distributions
    h(
      'div',
      { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 } },
      h(
        'div',
        null,
        h('div', { style: { fontSize: 9, color: C.textMute, marginBottom: 4 } }, '策略框架'),
        Object.entries(stratMap)
          .sort((a, b) => b[1] - a[1])
          .map(([s, n]) =>
            h(
              'div',
              { key: s, style: { fontSize: 10, color: C.textSec, marginBottom: 2 } },
              s,
              ' ',
              h('span', { style: { color: C.text, fontWeight: 600 } }, n)
            )
          )
      ),
      h(
        'div',
        null,
        h('div', { style: { fontSize: 9, color: C.textMute, marginBottom: 4 } }, '持有週期'),
        Object.entries(periodMap).map(([p, n]) =>
          h(
            'div',
            { key: p, style: { fontSize: 10, color: C.textSec, marginBottom: 2 } },
            p === '短' ? '短期' : p === '中' ? '中期' : p === '短中' ? '短中期' : '中長期',
            ' ',
            h('span', { style: { color: C.text, fontWeight: 600 } }, n)
          )
        )
      ),
      h(
        'div',
        null,
        h('div', { style: { fontSize: 9, color: C.textMute, marginBottom: 4 } }, '持倉定位'),
        Object.entries(posMap)
          .sort((a, b) => b[1] - a[1])
          .map(([p, val]) =>
            h(
              'div',
              { key: p, style: { fontSize: 10, color: C.textSec, marginBottom: 2 } },
              p,
              ' ',
              h(
                'span',
                { style: { color: C.text, fontWeight: 600 } },
                `${((val / indTotal) * 100).toFixed(0)}%`
              )
            )
          )
      )
    )
  )
}

/**
 * Top 5 Holdings by Market Value
 */
export function Top5Holdings({ holdings, totalVal }) {
  const top5 = [...holdings]
    .sort((a, b) => getHoldingMarketValue(b) - getHoldingMarketValue(a))
    .slice(0, 5)

  if (top5.length === 0) return null

  return h(
    Card,
    { style: { marginBottom: 8 } },
    h('div', { style: lbl }, '市值佔比 Top 5'),
    h(
      'div',
      { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
      top5.map((holding) => {
        const pct = (getHoldingMarketValue(holding) / Math.max(totalVal, 1)) * 100
        return h(
          'div',
          {
            key: holding.code,
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: C.subtle,
              border: `1px solid ${C.border}`,
              borderRadius: 20,
              padding: '4px 10px',
            },
          },
          h('span', { style: { fontSize: 11, color: C.textSec, fontWeight: 500 } }, holding.name),
          h(
            'span',
            { style: { fontSize: 11, fontWeight: 700, color: C.text } },
            `${pct.toFixed(1)}%`
          )
        )
      })
    )
  )
}

/**
 * Winners and Losers Summary
 */
export function WinLossSummary({ winners, losers }) {
  return h(
    'div',
    { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 } },
    h(
      Card,
      {
        style: {
          borderLeft: `3px solid ${alpha(C.up, '40')}`,
          padding: '8px 10px',
        },
      },
      h(
        'div',
        { style: { ...lbl, color: C.textSec, marginBottom: 3 } },
        `獲利 ${winners.length}檔`
      ),
      winners.slice(0, 3).map((holding) =>
        h(
          'div',
          {
            key: holding.code,
            style: { display: 'flex', justifyContent: 'space-between', marginTop: 4 },
          },
          h('span', { style: { fontSize: 11, color: C.textSec } }, holding.name),
          h(
            'span',
            { style: { fontSize: 11, fontWeight: 600, color: C.text } },
            `+${getHoldingReturnPct(holding).toFixed(2)}%`
          )
        )
      )
    ),
    h(
      Card,
      {
        style: {
          borderLeft: `3px solid ${alpha(C.down, '40')}`,
          padding: '8px 10px',
        },
      },
      h('div', { style: { ...lbl, color: C.down, marginBottom: 3 } }, `虧損 ${losers.length}檔`),
      losers.slice(0, 3).map((holding) =>
        h(
          'div',
          {
            key: holding.code,
            style: { display: 'flex', justifyContent: 'space-between', marginTop: 4 },
          },
          h('span', { style: { fontSize: 11, color: C.textSec } }, holding.name),
          h(
            'span',
            { style: { fontSize: 11, fontWeight: 600, color: C.down } },
            `${getHoldingReturnPct(holding).toFixed(2)}%`
          )
        )
      )
    )
  )
}

/**
 * Daily Insight Card — 今日收盤快評摘要
 */
function DailyInsightCard({ latestInsight }) {
  if (!latestInsight) return null
  // 取第一段（到第一個 ## 或 --- 為止）作為摘要
  const full = String(latestInsight || '')
  const firstBreak = full.search(/\n#{1,3}\s|\n---/)
  const summary = firstBreak > 0 ? full.slice(0, firstBreak).trim() : full.slice(0, 200).trim()
  if (!summary) return null

  return h(
    Card,
    { style: { marginBottom: 8, borderLeft: `3px solid ${C.accent}` } },
    h(
      'div',
      {
        style: {
          fontSize: 10,
          color: C.textMute,
          marginBottom: 4,
          letterSpacing: '0.06em',
          fontWeight: 600,
        },
      },
      'AI 今日快評'
    ),
    h(Md, { text: summary, color: C.textSec })
  )
}

/**
 * Main Holdings Panel Component
 */
export function HoldingsPanel({
  activePortfolioId = '',
  holdings = [],
  totalVal = 0,
  totalCost = 0,
  todayTotalPnl = 0,
  winners = [],
  losers = [],
  top5: _top5 = [],
  holdingsIntegrityIssues = [],
  showReversal: _showReversal = false,
  setShowReversal: _setShowReversal = () => {},
  reversalConditions: _reversalConditions = {},
  latestInsight = null,
  operatingContext = null,
  children,
}) {
  return h(
    'div',
    { 'data-testid': 'holdings-panel' },
    h(OperatingContextCard, { context: operatingContext, variant: 'home' }),
    h(
      'div',
      {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 8,
          alignItems: 'start',
          marginBottom: 8,
        },
      },
      h(
        'div',
        { style: { minWidth: 0 } },
        // Summary metrics
        h(HoldingsSummary, { holdings, totalVal, totalCost, todayTotalPnl }),
        h(TrackedStocksSyncBadge, { portfolioId: activePortfolioId })
      ),
      h(
        Card,
        {
          style: {
            padding: '18px 18px 14px',
          },
        },
        h(HoldingsRing, { holdings, totalVal })
      )
    ),

    // Daily insight card
    h(DailyInsightCard, { latestInsight }),

    // Integrity warning
    h(HoldingsIntegrityWarning, { issues: holdingsIntegrityIssues }),

    // Portfolio health check
    h(PortfolioHealthCheck, { holdings }),

    // Top 5
    h(Top5Holdings, { holdings, totalVal }),

    // Win/Loss summary
    h(WinLossSummary, { winners, losers }),

    // Children (additional content like holdings table)
    children
  )
}
