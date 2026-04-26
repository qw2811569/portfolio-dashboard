import { createElement as h, useState } from 'react'
import { C, alpha } from '../../theme.js'
import {
  AccuracyGateBlock,
  Card,
  Button,
  DataError,
  DataSourceBadge,
  MarkdownText,
  OperatingContextCard,
  StreamingText,
} from '../common'
import { EmptyState } from '../common/EmptyState.jsx'
import { Skeleton } from '../common/Skeleton.jsx'
import { SeasonalityHeatmap } from './SeasonalityHeatmap.jsx'
import { resolveResearchAccuracyGate } from '../../lib/accuracyGateUi.js'
import { getViewModeComplianceMessage, isViewModeEnabled } from '../../lib/viewModeContract.js'

const lbl = {
  fontSize: 12,
  color: C.textMute,
  letterSpacing: '0.06em',
  fontWeight: 600,
  marginBottom: 4,
}

function describeStatus(kind, status) {
  if (kind === 'target') {
    if (status === 'fresh') return '目標價還算新'
    if (status === 'aging') return '目標價有點舊了'
    if (status === 'stale') return '目標價太久沒更新'
    return '還沒有目標價資料'
  }

  if (status === 'fresh') return '財報資料還算新'
  if (status === 'aging') return '財報資料有點舊了'
  if (status === 'stale') return '財報資料太久沒更新'
  return '還沒有財報資料'
}

function getReportRefreshError(holdings = [], reportRefreshMeta = {}) {
  const statusWeight = {
    401: 4,
    '5xx': 3,
    offline: 2,
    404: 1,
  }

  return (Array.isArray(holdings) ? holdings : [])
    .map((holding) => {
      const meta = reportRefreshMeta?.[holding.code] || null
      if (!meta || meta.lastStatus !== 'failed' || !meta.errorStatus) return null
      return {
        code: holding.code,
        name: holding.name,
        status: meta.errorStatus,
        weight: statusWeight[String(meta.errorStatus)] || 0,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.weight - a.weight || String(a.code).localeCompare(String(b.code)))[0]
}

function ViewModeNotice({ note }) {
  if (!note) return null

  return h(
    Card,
    {
      style: { marginBottom: 8, borderLeft: `3px solid ${alpha(C.amber, '40')}` },
    },
    h('div', { style: { ...lbl, color: C.textSec } }, '合規顯示模式'),
    h('div', { style: { fontSize: 12, color: C.textSec, lineHeight: 1.7 } }, note)
  )
}

function ResearchHistoryErrorState({ message = '', onRetry = null }) {
  return h(
    Card,
    {
      'data-testid': 'research-history-error',
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(C.down, '40')}`,
      },
    },
    h('div', { style: { ...lbl, color: C.down } }, '研究資料同步失敗'),
    h(
      'div',
      {
        style: {
          fontSize: 12,
          color: C.textSec,
          lineHeight: 1.7,
          marginBottom: onRetry ? 10 : 0,
        },
      },
      '資料源暫時不通，這次沒有成功拉到研究歷史。'
    ),
    message &&
      h(
        'div',
        {
          style: {
            fontSize: 11,
            color: C.textMute,
            lineHeight: 1.7,
            marginBottom: onRetry ? 10 : 0,
          },
        },
        message
      ),
    typeof onRetry === 'function' &&
      h(
        Button,
        {
          color: 'amber',
          size: 'sm',
          style: { textTransform: 'none' },
          onClick: onRetry,
        },
        '重試'
      )
  )
}

function buildCompressedResearchNarrative(results) {
  const summary = String(results?.summary || '').trim()
  if (summary) return summary

  const firstRound = String(results?.rounds?.[0]?.content || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (firstRound) {
    return firstRound.length > 180 ? `${firstRound.slice(0, 180)}...` : firstRound
  }

  return '研究結果已壓縮為組合層級 narrative，不顯示 thesis diff 與逐檔追蹤細節。'
}

function CompressedResearchResults({ results }) {
  if (!results) return null

  const proposalCount = [results?.brainProposal, results?.knowledgeProposal].filter(Boolean).length
  const roundsCount = Array.isArray(results?.rounds) ? results.rounds.length : 0

  return h(
    Card,
    {
      'data-testid': 'compressed-research-results',
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(C.amber, '40')}`,
      },
    },
    h('div', { style: { ...lbl, color: C.textSec } }, '研究摘要 · aggregate only'),
    h(
      'div',
      {
        style: {
          fontSize: 11,
          color: C.textSec,
          lineHeight: 1.8,
          marginBottom: 8,
        },
      },
      buildCompressedResearchNarrative(results)
    ),
    h(
      'div',
      {
        style: {
          display: 'flex',
          gap: 4,
          flexWrap: 'wrap',
        },
      },
      h(
        'span',
        {
          style: {
            fontSize: 11,
            padding: '4px 8px',
            borderRadius: 8,
            background: alpha(C.amber, '14'),
            border: `1px solid ${alpha(C.amber, '22')}`,
            color: C.textSec,
          },
        },
        `${roundsCount} 輪研究已壓縮`
      ),
      proposalCount > 0 &&
        h(
          'span',
          {
            style: {
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 8,
              background: alpha(C.positive, '12'),
              border: `1px solid ${alpha(C.positive, '22')}`,
              color: C.textSec,
            },
          },
          `${proposalCount} 個提案已改為摘要`
        )
    )
  )
}

/**
 * Research Panel Header
 */
export function ResearchHeader({
  onEvolve,
  onRefresh,
  researching,
  reportRefreshing,
  reportRefreshStatus,
}) {
  return h(
    Card,
    {
      style: { marginBottom: 8, borderLeft: `3px solid ${alpha(C.positive, '40')}` },
    },
    h('div', { style: { ...lbl, color: C.textSec, marginBottom: 4 } }, 'AI 投資助手'),
    h(
      'div',
      { style: { fontSize: 11, color: C.textSec, lineHeight: 1.7, marginBottom: 8 } },
      '不只看單一股票，還會順手幫你檢查整個投資節奏。',
      '哪裡決策卡住、哪裡資料不夠、哪裡該先補強，這裡會直接講白。'
    ),
    h(
      'div',
      { style: { display: 'flex', gap: 4, marginBottom: 8 } },
      h(
        Button,
        {
          onClick: onEvolve,
          disabled: researching,
          style: {
            flex: 1,
            padding: '12px',
            borderRadius: 8,
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            cursor: researching ? 'not-allowed' : 'pointer',
            background: researching ? C.subtle : C.fillTomato,
            color: researching ? C.textMute : C.onFill,
          },
        },
        researching ? '全組合研究 + 建議生成中...' : '🧬 全組合研究 + AI 策略建議'
      ),
      h(
        Button,
        {
          onClick: onRefresh,
          disabled: reportRefreshing,
          style: {
            padding: '12px 12px',
            borderRadius: 8,
            border: `1px solid ${alpha(C.amber, '2a')}`,
            fontSize: 12,
            fontWeight: 600,
            cursor: reportRefreshing ? 'not-allowed' : 'pointer',
            background: alpha(C.amber, '15'),
            color: reportRefreshing ? C.textMute : C.textSec,
            whiteSpace: 'nowrap',
          },
        },
        reportRefreshing ? '整理資料中...' : '補最新報告'
      )
    ),
    reportRefreshStatus &&
      h('div', { style: { fontSize: 12, color: C.textMute, marginBottom: 8 } }, reportRefreshStatus)
  )
}

/**
 * Stock Research Buttons
 */
export function StockResearchButtons({
  holdings,
  onResearch,
  researching,
  researchTarget,
  STOCK_META,
  IND_COLOR,
}) {
  return h(
    'div',
    null,
    h('div', { style: { fontSize: 11, color: C.textMute, marginBottom: 4 } }, '想先深挖哪一檔：'),
    h(
      'div',
      { style: { display: 'flex', gap: 4, flexWrap: 'wrap' } },
      holdings.map((holding) => {
        const m = STOCK_META?.[holding.code]
        const color = m ? IND_COLOR?.[m.industry] || C.textMute : C.textMute
        const isTarget = researching && researchTarget === holding.code
        return h(
          Button,
          {
            key: holding.code,
            onClick: () => onResearch('single', holding),
            disabled: researching,
            style: {
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 6,
              cursor: researching ? 'not-allowed' : 'pointer',
              background: isTarget ? alpha(color, '20') : C.raised,
              border: `1px solid ${isTarget ? color : C.border}`,
              color: isTarget ? color : C.textSec,
              whiteSpace: 'nowrap',
            },
          },
          isTarget ? '研究中...' : holding.name
        )
      })
    )
  )
}

/**
 * Data Refresh Center
 */
export function DataRefreshCenter({ dataRefreshRows }) {
  if (!dataRefreshRows || dataRefreshRows.length === 0) return null

  return h(
    Card,
    {
      style: { marginBottom: 8, borderLeft: `3px solid ${alpha(C.amber, '40')}` },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 8,
        },
      },
      h(
        'div',
        null,
        h('div', { style: { ...lbl, marginBottom: 4, color: C.textSec } }, '先補資料'),
        h(
          'div',
          { style: { fontSize: 11, color: C.textSec, lineHeight: 1.7 } },
          '有些股票資料還不齊。先把舊報告和缺的財報補一補，後面的研究會準很多。'
        )
      ),
      h(
        'div',
        { style: { display: 'flex', gap: 4, flexWrap: 'wrap' } },
        dataRefreshRows.slice(0, 4).map((item) =>
          h(
            'span',
            {
              key: item.code,
              style: {
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 8,
                background: C.surface,
                border: `1px solid ${C.border}`,
                color: C.textSec,
              },
            },
            `${item.name} 要補`
          )
        )
      )
    ),
    h(
      'div',
      { style: { display: 'grid', gap: 8 } },
      dataRefreshRows.slice(0, 5).map((item) =>
        h(
          'div',
          {
            key: item.code,
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              background: C.surface,
              border: `1px solid ${C.borderSub}`,
              borderRadius: 8,
              padding: '8px 8px',
            },
          },
          h(
            'div',
            null,
            h(
              'div',
              { style: { fontSize: 11, color: C.text, fontWeight: 500 } },
              `${item.name} (${item.code})`
            ),
            item.targetLabel
              ? h(
                  'div',
                  {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      flexWrap: 'wrap',
                      fontSize: 11,
                      marginTop: 4,
                      color: item.targetSource === 'per-band' ? C.textMute : C.textSec,
                    },
                  },
                  h(
                    'span',
                    {
                      style: {
                        fontSize: 11,
                        padding: '4px 8px',
                        borderRadius: 3,
                        fontWeight: 600,
                        background:
                          item.targetSource === 'per-band'
                            ? alpha(C.textMute, '14')
                            : alpha(C.positive, '14'),
                        color: C.textSec,
                      },
                    },
                    item.targetSource === 'per-band' ? '區間估算' : '券商報告'
                  ),
                  item.targetLabel,
                  item.targetStatus === 'aging'
                    ? h(
                        'span',
                        { style: { color: C.textSec, marginLeft: 4 } },
                        '\u26A0 報告有點舊了'
                      )
                    : null
                )
              : h(
                  'div',
                  { style: { fontSize: 11, color: C.textMute, marginTop: 4 } },
                  `${describeStatus('target', item.targetStatus)} · ${describeStatus('fundamental', item.fundamentalStatus)}`
                ),
            item.classificationNote &&
              h(
                'div',
                { style: { fontSize: 11, color: C.textSec, marginTop: 4, fontStyle: 'italic' } },
                item.classificationNote
              ),
            item.degradedReason &&
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexWrap: 'wrap',
                    fontSize: 11,
                    color: C.textSec,
                    marginTop: 4,
                  },
                },
                h(
                  'span',
                  {
                    style: {
                      padding: '4px 8px',
                      borderRadius: 8,
                      background: alpha(C.amber, '14'),
                      border: `1px solid ${alpha(C.amber, '28')}`,
                    },
                  },
                  item.degradedReason === 'quota-exceeded' ? 'FinMind 額度' : 'FinMind 卡住'
                ),
                item.fallbackAgeLabel
                  ? `先用 ${item.fallbackAgeLabel} 前那份數字撐著看`
                  : '先用前一版數字撐著看'
              ),
            item.staleCopy &&
              h(
                'div',
                { style: { fontSize: 11, color: C.textMute, marginTop: 4, lineHeight: 1.6 } },
                item.staleCopy
              )
          )
        )
      )
    ),
    h(
      'div',
      {
        style: {
          fontSize: 12,
          color: C.textMute,
          lineHeight: 1.7,
          marginTop: 8,
        },
      },
      '先按上方「補最新報告」，資料齊一點再開始研究會比較準。'
    )
  )
}

/**
 * Research Progress
 */
export function ResearchProgress({ researching, researchTarget, holdings }) {
  if (!researching) return null

  const isEvolve = researchTarget === 'EVOLVE'
  const isPortfolio = researchTarget === 'PORTFOLIO'
  const label = isEvolve
    ? 'AI 正在審視你的投資系統並產出策略建議'
    : isPortfolio
      ? `AI 正在進行全組合深度研究（${holdings?.length || 0} 檔持股）`
      : `AI 正在進行個股深度研究`

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        padding: '24px 16px',
        background: alpha(C.iron, '08'),
      },
    },
    h(
      'div',
      {
        style: {
          fontSize: 13,
          color: isEvolve ? C.up : C.positive,
          fontWeight: 600,
          marginBottom: 8,
        },
      },
      label
    ),
    h(
      'div',
      { style: { fontSize: 12, color: C.textMute, marginBottom: 12 } },
      isEvolve
        ? '3 輪迭代：系統診斷 → 進化建議 → AI 策略建議，預計 1-2 分鐘'
        : isPortfolio
          ? '逐一分析持股 + 組合策略 + AI 建議，預計 1-2 分鐘'
          : '3 輪迭代研究：基本面 → 風險催化 → 策略建議，預計 30 秒'
    ),
    h(Skeleton, { variant: 'card', count: isPortfolio ? 2 : 1 })
  )
}

function proposalStatusMeta(proposalStatus, gatePassed) {
  if (proposalStatus === 'applied') return { label: '已套用', color: C.textSec }
  if (proposalStatus === 'discarded') return { label: '已放棄', color: C.textMute }
  if (proposalStatus === 'blocked' || gatePassed === false)
    return { label: '風險偏高，暫不建議採用', color: C.down }
  return { label: '待決策', color: C.textSec }
}

function knowledgeProposalStatusMeta(status, gatePassed) {
  if (status === 'candidate' && gatePassed !== false)
    return { label: '建議可考慮採用', color: C.textSec }
  if (status === 'blocked' || gatePassed === false)
    return { label: '風險偏高，暫不建議採用', color: C.down }
  return { label: '暫無調整', color: C.textMute }
}

function formatConsensusPrice(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Number.isInteger(number) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(number)
}

function inferDataSource(item) {
  const source = String(item?.source || '')
    .trim()
    .toLowerCase()
  const tags = Array.isArray(item?.tags)
    ? item.tags.map((tag) =>
        String(tag || '')
          .trim()
          .toLowerCase()
      )
    : []

  if (source === 'finmind') return 'finmind'
  if (source === 'rss') return 'rss'
  if (source === 'cnyes_aggregate') return 'cnyes_aggregate'
  if (source === 'user_manual') return 'user_manual'
  if (source === 'gemini' || source === 'gemini_grounded') return 'gemini_grounded'
  if (source === 'cmoney') return 'cmoney'
  if (source.includes('cmoney')) return 'cmoney'
  if (tags.includes('gemini-grounding') || tags.includes('gemini-merged')) return 'gemini_grounded'
  if (tags.includes('cmoney-notes') || tags.includes('cmoney-merged')) return 'cmoney'
  if (tags.includes('rss-merged')) return 'rss'
  return null
}

function buildAnalystReportGroups(holdings, analystReports) {
  return (Array.isArray(holdings) ? holdings : [])
    .map((holding) => {
      const items = Array.isArray(analystReports?.[holding.code]?.items)
        ? analystReports[holding.code].items
        : []
      const visibleItems = items
        .filter((item) => item?.source !== 'cnyes_aggregate')
        .map((item) => ({
          ...item,
          dataSource: inferDataSource(item),
        }))

      if (visibleItems.length === 0) return null
      return {
        code: holding.code,
        name: holding.name,
        items: visibleItems,
      }
    })
    .filter(Boolean)
}

function getConsensusCards(holdings, analystReports) {
  return (Array.isArray(holdings) ? holdings : [])
    .map((holding) => {
      const items = Array.isArray(analystReports?.[holding.code]?.items)
        ? analystReports[holding.code].items
        : []
      const aggregateItem = items.find(
        (item) => item?.source === 'cnyes_aggregate' && item?.aggregate && item.aggregate !== null
      )
      if (!aggregateItem?.aggregate) return null

      const aggregate = aggregateItem.aggregate
      const medianTarget =
        Number.isFinite(Number(aggregate.medianTarget)) && Number(aggregate.medianTarget) > 0
          ? Number(aggregate.medianTarget)
          : null
      const meanTarget =
        Number.isFinite(Number(aggregate.meanTarget)) && Number(aggregate.meanTarget) > 0
          ? Number(aggregate.meanTarget)
          : null
      const min = Number.isFinite(Number(aggregate.min)) ? Number(aggregate.min) : null
      const max = Number.isFinite(Number(aggregate.max)) ? Number(aggregate.max) : null
      const firmsCount = Number.isFinite(Number(aggregate.firmsCount))
        ? Number(aggregate.firmsCount)
        : Number.isFinite(Number(aggregate.numEst))
          ? Number(aggregate.numEst)
          : null
      const displayTarget = medianTarget ?? meanTarget
      if (!displayTarget || !min || !max) return null

      return {
        code: holding.code,
        name: holding.name,
        displayTarget,
        meanTarget,
        min,
        max,
        firmsCount,
        rateDate: aggregate.rateDate || aggregateItem.publishedAt || null,
      }
    })
    .filter(Boolean)
}

function ConsensusRangeBar({ min, max, meanTarget }) {
  const span = max - min
  const markerPosition =
    Number.isFinite(meanTarget) && span > 0 ? ((meanTarget - min) / span) * 100 : 50

  return h(
    'div',
    { style: { marginTop: 8 } },
    h(
      'div',
      {
        style: {
          position: 'relative',
          height: 14,
          borderRadius: 999, // pill 999 keep: linear score track needs rounded caps
          background: alpha(C.up, '52'),
          border: '1px solid var(--positive-soft)',
          overflow: 'hidden',
        },
      },
      h('div', {
        style: {
          position: 'absolute',
          top: 1,
          bottom: 1,
          left: `${Math.max(0, Math.min(100, markerPosition))}%`,
          width: 2,
          background: 'var(--positive)',
          transform: 'translateX(-1px)',
        },
      }),
      h('div', {
        style: {
          position: 'absolute',
          top: '50%',
          left: `${Math.max(0, Math.min(100, markerPosition))}%`,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: 'var(--positive)',
          border: `2px solid ${C.card}`,
          transform: 'translate(-50%, -50%)',
          boxShadow: `0 0 0 2px ${alpha(C.positive, '30')}`,
        },
      })
    ),
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          marginTop: 4,
          fontSize: 12,
          color: C.textMute,
          fontFamily: 'var(--font-num)',
        },
      },
      h('span', null, `$${formatConsensusPrice(min)}`),
      h('span', { style: { color: C.textSec, fontWeight: 600 } }, 'mean'),
      h('span', null, `$${formatConsensusPrice(max)}`)
    )
  )
}

function ConsensusHighlightCard({ item }) {
  return h(
    Card,
    {
      highlighted: true,
      color: C.textSec,
      style: {
        border: '1px solid var(--positive-soft)',
        background: alpha(C.raised, 'fa'),
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
          alignItems: 'flex-start',
          marginBottom: 8,
        },
      },
      h(
        'div',
        null,
        h('div', { style: { ...lbl, color: C.textSec, marginBottom: 4 } }, '外資券商共識'),
        h('div', { style: { fontSize: 12, color: C.textMute } }, `${item.name} · ${item.code}`)
      ),
      h(
        'div',
        {
          style: {
            fontSize: 11,
            color: C.textSec,
            border: '1px solid var(--positive-soft)',
            background: alpha(C.positive, '18'),
            borderRadius: 8,
            padding: '4px 8px',
            letterSpacing: '0.06em',
          },
        },
        'FactSet 聚合'
      )
    ),
    h(
      'div',
      {
        style: {
          fontSize: 38,
          lineHeight: 1,
          color: C.text,
          fontFamily: 'var(--font-headline)',
          fontWeight: 600,
          marginBottom: 8,
        },
      },
      `$${formatConsensusPrice(item.displayTarget)}`
    ),
    h(
      'div',
      { style: { fontSize: 11, color: C.textSec } },
      `${item.firmsCount || '—'} 家投顧 · ${item.rateDate || '日期未知'}`
    ),
    h(ConsensusRangeBar, {
      min: item.min,
      max: item.max,
      meanTarget: item.meanTarget,
    })
  )
}

function ConsensusHighlights({ holdings, analystReports }) {
  const consensusCards = getConsensusCards(holdings, analystReports)
  if (consensusCards.length === 0) return null

  return h(
    'div',
    {
      style: {
        display: 'grid',
        gap: 8,
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        marginBottom: 8,
      },
    },
    consensusCards.map((item) => h(ConsensusHighlightCard, { key: item.code, item }))
  )
}

function renderAnalystReportTarget(item) {
  const target = Number(item?.target)
  if (Number.isFinite(target) && target > 0) {
    return `目標價 $${formatConsensusPrice(target)}`
  }

  if (item?.targetType === 'range') return '目標價區間'
  if (item?.targetType === 'narrative') return '觀點摘錄'
  return '研究摘要'
}

function AnalystReportRow({ item }) {
  const summary = item?.summary || item?.snippet || '沒有摘要'
  const metaParts = [renderAnalystReportTarget(item)]
  if (item?.firm) metaParts.push(item.firm)
  if (item?.publishedAt) metaParts.push(item.publishedAt)

  return h(
    'div',
    {
      style: {
        display: 'grid',
        gap: 4,
        padding: '8px 0',
        borderTop: `1px solid ${C.borderSub}`,
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        },
      },
      item?.url
        ? h(
            'a',
            {
              href: item.url,
              target: '_blank',
              rel: 'noreferrer',
              style: {
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 44,
                padding: '4px 8px',
                fontSize: 11,
                color: C.text,
                fontWeight: 600,
                lineHeight: 1.5,
                textDecoration: 'none',
              },
            },
            item.title || '未命名報告'
          )
        : h(
            'div',
            {
              style: {
                fontSize: 11,
                color: C.text,
                fontWeight: 600,
                lineHeight: 1.5,
              },
            },
            item?.title || '未命名報告'
          ),
      item?.dataSource && h(DataSourceBadge, { source: item.dataSource })
    ),
    h(
      'div',
      {
        style: {
          fontSize: 12,
          color: C.textSec,
          lineHeight: 1.7,
        },
      },
      summary
    ),
    h(
      'div',
      {
        style: {
          fontSize: 11,
          color: C.textMute,
          lineHeight: 1.6,
        },
      },
      metaParts.join(' · ')
    )
  )
}

function AnalystReportsSection({ holdings, analystReports }) {
  const groups = buildAnalystReportGroups(holdings, analystReports)
  if (groups.length === 0) return null

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(C.positive, '40')}`,
      },
    },
    h('div', { style: { ...lbl, color: C.textSec, marginBottom: 4 } }, '研究來源索引'),
    h(
      'div',
      { style: { fontSize: 11, color: C.textSec, lineHeight: 1.7, marginBottom: 8 } },
      '每則研究旁都標示資料來源，讓你分辨外資共識、新聞摘錄、AI 搜尋與投顧整理。'
    ),
    groups.map((group) =>
      h(
        'div',
        {
          key: group.code,
          style: {
            padding: '8px 0',
            borderTop: `1px solid ${C.borderSub}`,
          },
        },
        h(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
              flexWrap: 'wrap',
            },
          },
          h(
            'div',
            { style: { fontSize: 11, color: C.text, fontWeight: 600 } },
            `${group.name} · ${group.code}`
          ),
          h('div', { style: { fontSize: 11, color: C.textMute } }, `${group.items.length} 則`)
        ),
        group.items.map((item) =>
          h(AnalystReportRow, { key: item.id || item.hash || item.title, item })
        )
      )
    ),
    h(
      'div',
      {
        style: {
          fontSize: 12,
          color: C.textMute,
          lineHeight: 1.7,
          marginTop: 8,
        },
      },
      '💡 資料來源：FactSet 外資共識（cnyes）、媒體新聞（RSS）、AI 搜尋（Gemini grounding）、投顧摘錄（CMoney）。優先順序由系統自動決定。'
    )
  )
}

export function ResearchProposalCard({
  results,
  onApplyProposal,
  onDiscardProposal,
  proposalActionId,
  proposalActionType,
}) {
  const proposal = results?.brainProposal
  if (!proposal?.proposedBrain) return null

  const evaluation = proposal.evaluation || {}
  const proposalStatus = results?.proposalStatus || proposal.status || 'candidate'
  const statusMeta = proposalStatusMeta(proposalStatus, evaluation.passed)
  const actionBusy = Number(proposalActionId) === Number(results?.timestamp)
  const canApply =
    proposalStatus !== 'applied' && proposalStatus !== 'discarded' && evaluation.passed !== false

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(statusMeta.color, '45')}`,
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 8,
        },
      },
      h(
        'div',
        null,
        h('div', { style: { ...lbl, marginBottom: 4, color: statusMeta.color } }, 'AI 策略建議'),
        h(
          'div',
          { style: { fontSize: 12, color: C.text, fontWeight: 600 } },
          proposal.summary || '—'
        ),
        h(
          'div',
          { style: { fontSize: 12, color: C.textMute, marginTop: 4, lineHeight: 1.6 } },
          `${statusMeta.label} · ${evaluation.summary || '尚未評估'}`
        )
      ),
      h(
        'div',
        { style: { display: 'flex', gap: 4, flexWrap: 'wrap' } },
        h(
          Button,
          {
            onClick: () => onApplyProposal?.(results),
            disabled: !canApply || actionBusy,
            style: {
              padding: '8px 8px',
              borderRadius: 7,
              border: 'none',
              background: canApply ? alpha(C.positive, '22') : C.subtle,
              color: canApply ? C.textSec : C.textMute,
              fontSize: 12,
              fontWeight: 600,
              cursor: !canApply || actionBusy ? 'not-allowed' : 'pointer',
            },
          },
          actionBusy && proposalActionType === 'apply' ? '套用中...' : '套用提案'
        ),
        h(
          Button,
          {
            onClick: () => onDiscardProposal?.(results),
            disabled: proposalStatus === 'discarded' || actionBusy,
            style: {
              padding: '8px 8px',
              borderRadius: 7,
              border: `1px solid ${alpha(C.down, '2a')}`,
              background: alpha(C.down, '12'),
              color: proposalStatus === 'discarded' ? C.textMute : C.down,
              fontSize: 12,
              fontWeight: 600,
              cursor: proposalStatus === 'discarded' || actionBusy ? 'not-allowed' : 'pointer',
            },
          },
          actionBusy && proposalActionType === 'discard' ? '放棄中...' : '放棄提案'
        )
      )
    ),
    h(
      'div',
      {
        style: {
          display: 'grid',
          gap: 4,
          fontSize: 12,
          color: C.textSec,
          lineHeight: 1.7,
        },
      },
      h(
        'div',
        null,
        `規則 ${proposal.metrics?.ruleCount || 0} 條 · 候選 ${proposal.metrics?.candidateRuleCount || 0} 條 · 教訓 ${proposal.metrics?.lessonCount || 0} 條`
      ),
      Array.isArray(evaluation.issues) &&
        evaluation.issues.length > 0 &&
        h('div', { style: { color: C.down } }, `風險提醒：${evaluation.issues.join('；')}`)
    )
  )
}

export function KnowledgeProposalCard({ results }) {
  const proposal = results?.knowledgeProposal
  if (!proposal) return null

  const evaluation = proposal.evaluation || {}
  const statusMeta = knowledgeProposalStatusMeta(proposal.status, evaluation.passed)
  const adjustments = Array.isArray(proposal.confidenceAdjustments)
    ? proposal.confidenceAdjustments
    : []

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(statusMeta.color, '45')}`,
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 8,
        },
      },
      h(
        'div',
        null,
        h('div', { style: { ...lbl, marginBottom: 4, color: statusMeta.color } }, '知識更新建議'),
        h(
          'div',
          { style: { fontSize: 12, color: C.text, fontWeight: 600 } },
          proposal.summary || '—'
        ),
        h(
          'div',
          { style: { fontSize: 12, color: C.textMute, marginTop: 4, lineHeight: 1.6 } },
          `${statusMeta.label} · ${evaluation.summary || '尚未評估'}`
        )
      ),
      h(
        'div',
        { style: { fontSize: 12, color: C.textMute, textAlign: 'right', lineHeight: 1.6 } },
        `調整 ${proposal.metrics?.adjustmentCount || adjustments.length} 筆`,
        h('br'),
        `已連結回饋 ${proposal.metrics?.feedbackLinkedCount || 0} / 未連結 ${proposal.metrics?.feedbackMissingLinkCount || 0}`
      )
    ),
    adjustments.length > 0 &&
      h(
        'div',
        { style: { display: 'grid', gap: 4, fontSize: 12, color: C.textSec, lineHeight: 1.7 } },
        adjustments
          .slice(0, 5)
          .map((item) =>
            h(
              'div',
              { key: item.id },
              `${item.id} ${item.title}：${Math.round(item.fromConfidence * 100)}% → ${Math.round(item.toConfidence * 100)}% · ${item.reason}`
            )
          )
      )
  )
}

/**
 * Research Results
 */
export function ResearchResults({
  results,
  streaming = false,
  onEnrich,
  enriching,
  onApplyProposal,
  onDiscardProposal,
  proposalActionId,
  proposalActionType,
  viewMode = 'retail',
}) {
  if (!results) return null
  if (!isViewModeEnabled('showResearchDiff', viewMode)) {
    return h(CompressedResearchResults, { results })
  }

  return h(
    'div',
    { style: { marginBottom: 8 } },
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        },
      },
      h(
        'div',
        { style: { ...lbl, marginBottom: 0, color: C.textSec } },
        `${results.name} · ${results.date}`
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          },
        },
        results.priceAtResearch &&
          h(
            'span',
            { style: { fontSize: 12, color: C.textMute } },
            `研究時股價 ${results.priceAtResearch}`
          ),
        results.mode === 'single' &&
          h(
            Button,
            {
              onClick: () => onEnrich(results),
              disabled: enriching === results.code,
              style: {
                padding: '4px 8px',
                borderRadius: 7,
                border: `1px solid ${alpha(C.amber, '2a')}`,
                background: alpha(C.amber, '15'),
                color: C.textSec,
                fontSize: 12,
                fontWeight: 500,
                cursor: enriching === results.code ? 'not-allowed' : 'pointer',
              },
            },
            enriching === results.code ? '寫入筆記中...' : '存到持股筆記'
          )
      )
    ),
    h(ResearchProposalCard, {
      results,
      onApplyProposal,
      onDiscardProposal,
      proposalActionId,
      proposalActionType,
    }),
    h(KnowledgeProposalCard, {
      results,
    }),
    results.rounds?.map((round, i) =>
      h(
        Card,
        {
          key: i,
          style: {
            marginBottom: 4,
            borderLeft: `2px solid ${alpha([C.positive, C.amber, C.cta][i % 3], '40')}`,
          },
        },
        h(
          'div',
          {
            style: {
              fontSize: 12,
              fontWeight: 600,
              color: [C.positive, C.amber, C.cta][i % 3],
              marginBottom: 4,
            },
          },
          `Round ${i + 1}：${round.title}`
        ),
        streaming
          ? h(StreamingText, {
              text: round.content,
              streaming: true,
              style: { color: C.textSec, fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap' },
            })
          : h(MarkdownText, { text: round.content, color: C.textSec })
      )
    )
  )
}

/**
 * Research History
 */
export function ResearchHistory({ history, onSelect, selectedId }) {
  if (!history || history.length === 0) return null

  return h(
    Card,
    null,
    h(
      'div',
      { style: { ...lbl, display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h('span', null, '歷史研究記錄'),
      h(
        'span',
        { style: { fontSize: 11, color: C.textMute, fontWeight: 400 } },
        `${history.length} 筆`
      )
    ),
    history.map((r, i) =>
      h(
        'div',
        {
          key: r.timestamp || i,
          onClick: () => onSelect(r),
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 4px',
            cursor: 'pointer',
            borderRadius: 6,
            background: selectedId === r.timestamp ? C.subtle : 'transparent',
            borderBottom: `1px solid ${C.borderSub}`,
          },
        },
        h(
          'div',
          null,
          h(
            'span',
            { style: { fontSize: 12, color: r.mode === 'evolve' ? C.up : C.text } },
            `${r.mode === 'evolve' ? '🧬 ' : '🔬 '}${r.name}`
          ),
          h('span', { style: { fontSize: 12, color: C.textMute, marginLeft: 4 } }, r.date)
        ),
        h('span', { style: { fontSize: 11, color: C.textMute } }, `${r.rounds?.length || 0} 輪分析`)
      )
    )
  )
}

/**
 * Main Research Panel
 */
export function ResearchPanel({
  holdings,
  holdingDossiers = [],
  researching,
  researchTarget,
  reportRefreshing,
  reportRefreshStatus,
  reportRefreshMeta = {},
  dataRefreshRows,
  researchResults,
  researchHistory,
  researchHistoryStatus = null,
  analystReports,
  enrichingResearchCode,
  proposalActionId,
  proposalActionType,
  STOCK_META,
  IND_COLOR,
  operatingContext,
  viewMode = 'retail',
  onEvolve,
  onRefresh,
  onResearch,
  onEnrich,
  onApplyProposal,
  onDiscardProposal,
  onSelectHistory,
}) {
  const complianceNote = getViewModeComplianceMessage(viewMode, operatingContext?.portfolioLabel)
  const reportRefreshError = getReportRefreshError(holdings, reportRefreshMeta)
  const hasHoldings = Array.isArray(holdings) && holdings.length > 0
  const researchAccuracyGate = resolveResearchAccuracyGate({
    results: researchResults,
    dataRefreshRows,
    viewMode,
  })
  const researchAccuracyGateKey = researchAccuracyGate
    ? [
        researchAccuracyGate.resource,
        researchAccuracyGate.reason,
        researchResults?.timestamp || researchResults?.code || '',
      ]
        .filter(Boolean)
        .join(':')
    : ''
  const [dismissedAccuracyGateKey, setDismissedAccuracyGateKey] = useState('')
  const showResearchAccuracyGate = Boolean(
    researchAccuracyGate && dismissedAccuracyGateKey !== researchAccuracyGateKey
  )
  const effectiveResearchHistoryStatus =
    researchHistoryStatus?.status ||
    (researchHistory == null ? (hasHoldings ? 'loading' : 'idle') : 'success')
  const researchHistoryErrorMessage = String(researchHistoryStatus?.message || '').trim()
  const isResearchHistoryLoading =
    !researching && !researchResults && hasHoldings && effectiveResearchHistoryStatus === 'loading'
  const showResearchHistoryError =
    !researching && !researchResults && effectiveResearchHistoryStatus === 'error'
  const showResearchEmpty =
    !researching &&
    !researchResults &&
    effectiveResearchHistoryStatus !== 'loading' &&
    effectiveResearchHistoryStatus !== 'error' &&
    ((Array.isArray(researchHistory) && researchHistory.length === 0) ||
      (!hasHoldings && researchHistory == null))

  const retryResearchAccuracyGate = () => {
    const matchedHolding = (Array.isArray(holdings) ? holdings : []).find(
      (item) => String(item?.code || '').trim() === String(researchResults?.code || '').trim()
    )

    if (researchResults?.mode === 'single' && matchedHolding && typeof onResearch === 'function') {
      onResearch('single', matchedHolding)
      return
    }

    if (
      (researchResults?.mode === 'portfolio' || researchResults?.mode === 'evolve') &&
      typeof onEvolve === 'function'
    ) {
      onEvolve()
      return
    }

    if (typeof onRefresh === 'function') onRefresh()
  }

  const retryResearchHistorySync = () => {
    if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
      window.location.reload()
      return
    }
    if (typeof onRefresh === 'function') {
      onRefresh()
    }
  }

  return h(
    'div',
    { 'data-testid': 'research-panel' },
    h(OperatingContextCard, { context: operatingContext }),
    isViewModeEnabled('showComplianceNote', viewMode) &&
      h(ViewModeNotice, { note: complianceNote }),
    h(ResearchHeader, {
      onEvolve,
      onRefresh,
      researching,
      reportRefreshing,
      reportRefreshStatus,
    }),
    reportRefreshError &&
      h(
        Card,
        {
          style: { marginBottom: 8, borderLeft: `3px solid ${alpha(C.amber, '40')}` },
        },
        h(DataError, {
          status: reportRefreshError.status,
          resource: 'analyst-reports',
          retryBehavior: 'manual',
          onRetry: onRefresh,
        }),
        h(
          'div',
          { style: { fontSize: 11, color: C.textMute, marginTop: 8, lineHeight: 1.6 } },
          `這輪卡在 ${reportRefreshError.name} (${reportRefreshError.code})`
        )
      ),
    h(StockResearchButtons, {
      holdings,
      onResearch,
      researching,
      researchTarget,
      STOCK_META,
      IND_COLOR,
    }),
    h(DataRefreshCenter, {
      dataRefreshRows,
    }),
    h(ResearchProgress, {
      researching,
      researchTarget,
      holdings,
    }),
    isResearchHistoryLoading &&
      h(
        Card,
        {
          style: {
            marginBottom: 8,
            padding: '20px 16px',
          },
        },
        h('div', { style: { ...lbl, color: C.textSec, marginBottom: 8 } }, '研究資料整理中'),
        h(
          'div',
          { style: { fontSize: 12, color: C.textMute, lineHeight: 1.7, marginBottom: 12 } },
          '先把公開報告索引與研究歷史接回來，畫面不會先掉進空白。'
        ),
        h(Skeleton, { variant: 'card', count: 1 })
      ),
    showResearchHistoryError &&
      h(ResearchHistoryErrorState, {
        message: researchHistoryErrorMessage,
        onRetry: retryResearchHistorySync,
      }),
    h(ConsensusHighlights, {
      holdings,
      analystReports,
    }),
    h(SeasonalityHeatmap, {
      holdings,
      holdingDossiers,
    }),
    h(AnalystReportsSection, {
      holdings,
      analystReports,
    }),
    showResearchAccuracyGate
      ? h(AccuracyGateBlock, {
          reason: researchAccuracyGate.reason,
          resource: researchAccuracyGate.resource,
          context: researchAccuracyGate.context,
          onRetry: retryResearchAccuracyGate,
          onDismiss: () => setDismissedAccuracyGateKey(researchAccuracyGateKey),
        })
      : h(ResearchResults, {
          results: researchResults,
          onEnrich,
          enriching: enrichingResearchCode,
          onApplyProposal,
          onDiscardProposal,
          proposalActionId,
          proposalActionType,
          viewMode,
          streaming: researching,
        }),
    showResearchEmpty &&
      h(EmptyState, {
        resource: hasHoldings ? 'research' : 'holdings',
      }),
    h(ResearchHistory, {
      history: researchHistory,
      onSelect: onSelectHistory,
      selectedId: researchResults?.timestamp,
    })
  )
}
