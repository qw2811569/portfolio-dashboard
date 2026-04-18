import { createElement as h, useEffect, useMemo, useState } from 'react'
import { C, alpha } from '../../theme.js'
import { Card, Button, Badge, OperatingContextCard, StaleBadge } from '../common'
import Md from '../Md.jsx'
import { buildDailyEventCollections } from '../../lib/dailyAnalysisRuntime.js'
import { buildSameDayDailyReportDiff } from '../../lib/dailyReportDiff.js'
import { isClosedEvent, toSlashDate } from '../../lib/eventUtils.js'

const lbl = {
  fontSize: 10,
  color: C.textMute,
  letterSpacing: '0.06em',
  fontWeight: 600,
  marginBottom: 5,
}

const pc = (p) => (p == null ? C.textMute : p >= 0 ? C.up : C.down)

function describeRuleFreshness(status) {
  if (status === 'fresh') return '資料還算新'
  if (status === 'aging') return '資料有點舊'
  if (status === 'stale') return '資料太久沒更新'
  if (status === 'missing') return '資料還不夠'
  return status || ''
}

function appendKnowledgeFeedback({ analysisId, signal, date, injectedKnowledgeIds = [] }) {
  const log = JSON.parse(localStorage.getItem('kb-feedback-log') || '[]')
  log.push({
    analysisId,
    signal,
    timestamp: Date.now(),
    date,
    injectedKnowledgeIds: Array.isArray(injectedKnowledgeIds) ? injectedKnowledgeIds : [],
  })
  if (log.length > 200) log.splice(0, log.length - 200)
  localStorage.setItem('kb-feedback-log', JSON.stringify(log))
}

function buildDailyStageMeta(report = null) {
  const stage = String(report?.analysisStage || '').trim()
  const confirmation = report?.finmindConfirmation
  const pendingCount = Array.isArray(confirmation?.pendingCodes)
    ? confirmation.pendingCodes.length
    : 0
  const expectedLabel = confirmation?.expectedMarketDate
    ? confirmation.expectedMarketDate.replace(/-/g, '/')
    : ''

  if (stage === 't1-confirmed') {
    return {
      badgeColor: 'teal',
      summary: expectedLabel
        ? `已用 FinMind ${expectedLabel} 的收盤後資料確認`
        : '已用 FinMind 的收盤後資料確認',
    }
  }

  if (stage === 't0-preliminary') {
    return {
      badgeColor: 'amber',
      summary:
        pendingCount > 0
          ? `仍有 ${pendingCount} 檔還在等 FinMind 收盤後資料`
          : 'FinMind 的收盤後資料還沒到齊',
    }
  }

  return {
    badgeColor: 'default',
    summary: '這是較早版本的分析，當時還沒有補做資料確認',
  }
}

/**
 * Empty state for daily analysis
 */
export function DailyAnalysisEmpty({
  onAnalyze,
  onStressTest,
  analyzing,
  stressTesting,
  analyzeLabel = '開始今日收盤分析',
}) {
  return h(
    Card,
    {
      style: { textAlign: 'center', padding: '20px 14px', marginBottom: 10 },
    },
    h('div', { style: { fontSize: 24, marginBottom: 6, opacity: 0.4 } }, '◎'),
    h(
      'div',
      { style: { fontSize: 12, color: C.textSec, fontWeight: 500, marginBottom: 4 } },
      '每日收盤分析'
    ),
    h(
      'div',
      { style: { fontSize: 10, color: C.textMute, marginBottom: 12, lineHeight: 1.6 } },
      '分析今日股價變動與事件連動性 · 自動比對持倉漲跌、異常波動、策略建議'
    ),
    h(
      'div',
      { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
      h(
        Button,
        {
          onClick: onAnalyze,
          style: {
            padding: '10px 24px',
            borderRadius: 8,
            border: 'none',
            background: `linear-gradient(135deg,${alpha(C.blue, '20')},${alpha(C.olive, '20')})`,
            color: C.onFill,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.03em',
          },
        },
        analyzeLabel
      ),
      h(
        Button,
        {
          onClick: onStressTest,
          disabled: stressTesting || analyzing,
          style: {
            padding: '10px 16px',
            borderRadius: 8,
            border: `1px solid ${alpha(C.down, 0.4)}`,
            background: 'transparent',
            color: C.down,
            fontSize: 11,
            fontWeight: 600,
            cursor: stressTesting ? 'not-allowed' : 'pointer',
            letterSpacing: '0.03em',
            opacity: stressTesting ? 0.5 : 1,
          },
        },
        stressTesting ? '測試中...' : '⚠️ 風險壓力測試'
      )
    )
  )
}

export function ReviewGateCard({
  pendingReviewItems = [],
  onNavigateReview = () => {},
  actionLabel = '仍要分析',
}) {
  if (!Array.isArray(pendingReviewItems) || pendingReviewItems.length === 0) return null

  const preview = pendingReviewItems
    .slice(0, 2)
    .map((item) => item?.title)
    .filter(Boolean)
    .join('、')

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(C.amber, '40')}`,
      },
    },
    h('div', { style: { ...lbl, color: C.amber } }, `待復盤事件 · ${pendingReviewItems.length}件`),
    h(
      'div',
      { style: { fontSize: 10, color: C.textSec, lineHeight: 1.7, marginBottom: 8 } },
      `目前還有 ${pendingReviewItems.length} 件事件已到復盤時間，先確認結果再跑收盤分析，避免 AI 仍把舊事件當成未結案訊號。`,
      preview ? ` 例如：${preview}` : ''
    ),
    h(
      'div',
      { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
      h(
        Button,
        {
          onClick: onNavigateReview,
          style: {
            padding: '8px 14px',
            borderRadius: 8,
            border: `1px solid ${alpha(C.olive, '2a')}`,
            background: alpha(C.olive, '12'),
            color: C.olive,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          },
        },
        '先前往復盤'
      ),
      h(
        'span',
        {
          style: {
            fontSize: 10,
            color: C.textMute,
            alignSelf: 'center',
          },
        },
        `${actionLabel} 還是可以手動執行，但建議先把復盤補完再分析。`
      )
    )
  )
}

/**
 * Analyzing state — with spinner and step progress
 */
export function AnalyzingState({ step }) {
  return h(
    Card,
    {
      style: {
        textAlign: 'center',
        padding: '40px 16px',
        background: `linear-gradient(135deg, ${alpha(C.blue, '08')}, ${alpha(C.lavender, '08')})`,
      },
    },
    // Spinning loader
    h('div', {
      style: {
        width: 36,
        height: 36,
        margin: '0 auto 16px',
        border: `3px solid ${alpha(C.blue, '20')}`,
        borderTop: `3px solid ${C.blue}`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      },
    }),
    h(
      'div',
      {
        style: {
          fontSize: 13,
          color: C.text,
          fontWeight: 600,
          marginBottom: 10,
        },
      },
      '正在進行收盤分析'
    ),
    // Step indicator
    h(
      'div',
      {
        style: {
          fontSize: 11,
          color: C.blue,
          fontWeight: 500,
          marginBottom: 12,
          minHeight: 16,
        },
      },
      step || '準備中...'
    ),
    // Progress bar
    h(
      'div',
      {
        style: {
          maxWidth: 240,
          margin: '0 auto',
          height: 4,
          background: C.subtle,
          borderRadius: 2,
          overflow: 'hidden',
        },
      },
      h('div', {
        style: {
          height: '100%',
          width: '60%',
          background: `linear-gradient(90deg, ${C.blue}, ${C.lavender})`,
          borderRadius: 2,
          animation: 'indeterminate 1.8s ease-in-out infinite',
        },
      })
    ),
    h(
      'div',
      {
        style: {
          fontSize: 10,
          color: C.textMute,
          marginTop: 10,
        },
      },
      'AI 正在分析持股、事件與市場變化，請稍候...'
    )
  )
}

/**
 * Stress test result
 */
export function StressResult({ result, onClose }) {
  if (!result) return null

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(C.down, '40')}`,
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
          cursor: 'pointer',
        },
        onClick: onClose,
      },
      h(
        'div',
        { style: { fontSize: 13, fontWeight: 600, color: C.down } },
        `⚠️ 風險壓力測試 · ${result.date}`
      ),
      h('span', { style: { fontSize: 11, color: C.textMute } }, '點擊關閉')
    ),
    h(
      'div',
      {
        style: { fontSize: 12, color: C.text, whiteSpace: 'pre-wrap', lineHeight: 1.8 },
      },
      result.text
    )
  )
}

/**
 * Daily Report Summary Card
 */
export function DailyReportSummary({ report, expanded, onToggle }) {
  // Calculate analysis stats
  const eventCount = report.eventCorrelations?.length || 0
  const knowledgeCount = report.injectedKnowledgeIds?.length || 0
  const finmindCount = report.finmindDataCount || 0
  const stageMeta = buildDailyStageMeta(report)

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(report.totalTodayPnl >= 0 ? C.up : C.down, '40')}`,
        cursor: 'pointer',
      },
      onClick: onToggle,
    },
    h(
      'div',
      {
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
      },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 6 } },
        h('div', { style: { ...lbl, marginBottom: 0 } }, `${report.date} 收盤分析`),
        h('span', { style: { fontSize: 9, color: C.textMute } }, report.time),
        report.analysisStageLabel &&
          h(Badge, { color: stageMeta.badgeColor }, report.analysisStageLabel),
        !expanded &&
          report.anomalies?.length > 0 &&
          h(Badge, { color: 'amber' }, `異常 ${report.anomalies.length}`),
        !expanded &&
          report.needsReview?.length > 0 &&
          h(Badge, { color: 'up' }, `復盤 ${report.needsReview.length}`)
      ),
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        h(
          'div',
          {
            style: {
              fontSize: 18,
              fontWeight: 700,
              color: pc(report.totalTodayPnl),
              lineHeight: 1.1,
            },
          },
          `${report.totalTodayPnl >= 0 ? '+' : ''}${report.totalTodayPnl.toLocaleString()}`
        ),
        h('span', { style: { fontSize: 9, color: C.textMute } }, expanded ? '▲' : '▼')
      )
    ),
    // Analysis stats (shown when expanded)
    expanded &&
      h(
        'div',
        {
          style: {
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
          },
        },
        h('div', { style: { fontSize: 9, color: C.textSec } }, `引用 ${eventCount} 個事件`),
        h('div', { style: { fontSize: 9, color: C.textSec } }, `${knowledgeCount} 條知識庫規則`),
        h('div', { style: { fontSize: 9, color: C.textSec } }, `${finmindCount} 筆 FinMind 數據`),
        h('div', { style: { fontSize: 9, color: C.textSec } }, stageMeta.summary)
      )
  )
}

export function AnalysisStageCard({ report }) {
  if (!report) return null

  const stageMeta = buildDailyStageMeta(report)
  const confirmation = report.finmindConfirmation
  const pendingCodes = Array.isArray(confirmation?.pendingCodes) ? confirmation.pendingCodes : []

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${
          stageMeta.badgeColor === 'teal' ? alpha(C.teal, '40') : alpha(C.amber, '40')
        }`,
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
          marginBottom: 6,
        },
      },
      h(
        'div',
        { style: { ...lbl, color: stageMeta.badgeColor === 'teal' ? C.teal : C.amber } },
        '資料確認階段'
      ),
      h(Badge, { color: stageMeta.badgeColor }, report.analysisStageLabel || '既有版本')
    ),
    h('div', { style: { fontSize: 10, color: C.textSec, lineHeight: 1.7 } }, stageMeta.summary),
    pendingCodes.length > 0 &&
      h(
        'div',
        { style: { fontSize: 9, color: C.textMute, marginTop: 6, lineHeight: 1.7 } },
        `待確認標的：${pendingCodes.slice(0, 5).join('、')}${pendingCodes.length > 5 ? '…' : ''}`
      ),
    report.rerunReason === 'finmind-confirmed' &&
      h(
        'div',
        { style: { fontSize: 9, color: C.teal, marginTop: 6 } },
        '這份分析是由同日快版升級而來，已保留先前版本供追蹤。'
      ),
    report.rerunReason === 'finmind-auto-confirmed' &&
      h(
        'div',
        { style: { fontSize: 9, color: C.teal, marginTop: 6 } },
        '系統在偵測到 FinMind 日終資料齊全後，已自動補跑並保留同日快版供比對。'
      )
  )
}

export function RitualModeCard({ report }) {
  const ritualMode = report?.ritualMode
  const card = report?.tomorrowActionCard
  if (!ritualMode && !card) return null

  const immediateActions = Array.isArray(card?.immediateActions) ? card.immediateActions : []
  const watchlist = Array.isArray(card?.watchlist) ? card.watchlist : []
  const notes = Array.isArray(card?.notes) ? card.notes : []

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(C.olive, '40')}`,
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
          marginBottom: 6,
        },
      },
      h('div', { style: { ...lbl, color: C.olive } }, ritualMode?.label || '收盤後儀式模式'),
      h(Badge, { color: 'olive' }, card?.title || '明日動作卡')
    ),
    h(
      'div',
      { style: { fontSize: 10, color: C.textSec, lineHeight: 1.7, marginBottom: 8 } },
      '流程固定為：同步收盤價 -> 回看今日偏差 -> 排定明日動作，避免隔天開盤前又重新猜一次。'
    ),
    immediateActions.length > 0 &&
      h(
        'div',
        { style: { marginBottom: watchlist.length > 0 || notes.length > 0 ? 8 : 0 } },
        h(
          'div',
          { style: { fontSize: 10, color: C.textSec, fontWeight: 600, marginBottom: 4 } },
          '明日立即執行'
        ),
        immediateActions.map((item, index) =>
          h(
            'div',
            {
              key: `ritual-immediate-${index}`,
              style: {
                fontSize: 10,
                color: C.text,
                lineHeight: 1.7,
                padding: '3px 0',
              },
            },
            `${index + 1}. ${item}`
          )
        )
      ),
    watchlist.length > 0 &&
      h(
        'div',
        { style: { marginBottom: notes.length > 0 ? 8 : 0 } },
        h(
          'div',
          { style: { fontSize: 10, color: C.textSec, fontWeight: 600, marginBottom: 4 } },
          '觀察清單'
        ),
        watchlist.map((item, index) =>
          h(
            'div',
            {
              key: `ritual-watch-${index}`,
              style: {
                fontSize: 10,
                color: C.text,
                lineHeight: 1.7,
                padding: '3px 0',
              },
            },
            `- ${item}`
          )
        )
      ),
    (card?.summary || notes.length > 0) &&
      h(
        'div',
        { style: { fontSize: 9, color: C.textMute, lineHeight: 1.7 } },
        card?.summary || notes.join(' / ')
      )
  )
}

export function WeeklyExportNarrativeCard({ report }) {
  if (!report) return null

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(C.blue, '40')}`,
      },
    },
    h('div', { style: { ...lbl, color: C.blue } }, '週報匯出內容'),
    h(
      'div',
      { style: { fontSize: 10, color: C.textSec, lineHeight: 1.7 } },
      '從 header 複製到 clipboard 的週報素材，現在會附帶 Weekly Narrative；若組合處於 insider 合規模式，也會自動加上 insider compliance notes。'
    )
  )
}

function DiffValue({ value, format = 'text' }) {
  if (format === 'markdown') {
    return h(
      'div',
      {
        style: {
          fontSize: 10,
          color: C.text,
          lineHeight: 1.7,
        },
      },
      h(Md, null, String(value || '').trim() || '無')
    )
  }

  return h(
    'div',
    {
      style: {
        fontSize: 10,
        color: C.text,
        lineHeight: 1.7,
        whiteSpace: 'pre-wrap',
      },
    },
    String(value || '').trim() || '無'
  )
}

export function SameDayDiffCard({ report, analysisHistory = [] }) {
  const [expanded, setExpanded] = useState(false)
  const diff = useMemo(
    () =>
      buildSameDayDailyReportDiff({
        currentReport: report,
        analysisHistory,
      }),
    [analysisHistory, report]
  )

  if (!diff) return null

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(diff.changeCount > 0 ? C.blue : C.teal, '40')}`,
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
          marginBottom: 6,
        },
      },
      h(
        'div',
        { style: { ...lbl, color: diff.changeCount > 0 ? C.blue : C.teal } },
        '同日版本差異'
      ),
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
        h(
          Badge,
          { color: diff.changeCount > 0 ? 'olive' : 'teal' },
          diff.changeCount > 0 ? '有更新' : '無差異'
        ),
        h(
          Badge,
          { color: 'default' },
          `${diff.previousReport.analysisStageLabel || '既有版本'} -> ${diff.currentReport.analysisStageLabel || '既有版本'}`
        )
      )
    ),
    h(
      'div',
      { style: { fontSize: 10, color: C.textSec, lineHeight: 1.7, marginBottom: 8 } },
      diff.summary
    ),
    h(
      Button,
      {
        onClick: () => setExpanded((value) => !value),
        style: {
          width: '100%',
          padding: '8px 12px',
          borderRadius: 8,
          border: `1px solid ${alpha(C.blue, '24')}`,
          background: alpha(C.blue, '10'),
          color: C.blue,
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: expanded ? 8 : 0,
        },
      },
      expanded ? '收合差異' : diff.changeCount > 0 ? '展開差異' : '查看確認說明'
    ),
    expanded &&
      h(
        'div',
        {
          style: {
            display: 'grid',
            gap: 8,
          },
        },
        diff.changes.length > 0
          ? diff.changes.map((change) =>
              h(
                'div',
                {
                  key: change.key,
                  style: {
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    padding: 10,
                    background: alpha(C.bg, '0d'),
                  },
                },
                h('div', { style: { ...lbl, marginBottom: 6 } }, change.label),
                h(
                  'div',
                  {
                    style: {
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                    },
                  },
                  h(
                    'div',
                    {
                      style: {
                        borderRadius: 8,
                        padding: 8,
                        background: alpha(C.textMute, '10'),
                      },
                    },
                    h('div', { style: { ...lbl, marginBottom: 4, color: C.textMute } }, '上一版'),
                    h(DiffValue, { value: change.previous, format: change.format })
                  ),
                  h(
                    'div',
                    {
                      style: {
                        borderRadius: 8,
                        padding: 8,
                        background: alpha(C.blue, '10'),
                      },
                    },
                    h('div', { style: { ...lbl, marginBottom: 4, color: C.blue } }, '目前版本'),
                    h(DiffValue, { value: change.current, format: change.format })
                  )
                )
              )
            )
          : h(
              'div',
              {
                style: {
                  fontSize: 10,
                  color: C.textMute,
                  lineHeight: 1.7,
                },
              },
              '這次主要是把快版補成正式版，內容本身沒有明顯變動。'
            )
      )
  )
}

function buildAutoConfirmUiState(state = null) {
  switch (state?.status) {
    case 'checking':
      return {
        tone: 'olive',
        summary: '正在檢查 FinMind 收盤後資料，若今天資料已齊全，系統會自動補跑資料確認版。',
      }
    case 'waiting':
      return {
        tone: 'amber',
        summary:
          state?.confirmation?.pendingCodes?.length > 0
            ? `剛檢查過，仍有 ${state.confirmation.pendingCodes.length} 檔還在等 FinMind 收盤後資料；稍後回到這頁會再自動重試。`
            : '剛檢查過，但收盤後資料仍未完全到齊；稍後回到這頁會再自動重試。',
      }
    case 'cooldown':
      return {
        tone: 'default',
        summary: '剛檢查過一次，為了避免重複打 API，這一版會先暫停自動重試。',
      }
    case 'error':
      return {
        tone: 'amber',
        summary: '自動檢查 FinMind 日終資料時發生問題，稍後回到這頁會再重試。',
      }
    default:
      return null
  }
}

function AutoConfirmCard({ state = null }) {
  const uiState = buildAutoConfirmUiState(state)
  if (!uiState) return null

  const toneColor =
    uiState.tone === 'olive' ? C.olive : uiState.tone === 'amber' ? C.amber : C.textMute

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${
          uiState.tone === 'olive'
            ? alpha(C.olive, '40')
            : uiState.tone === 'amber'
              ? alpha(C.amber, '40')
              : alpha(C.textMute, '35')
        }`,
      },
    },
    h('div', { style: { ...lbl, color: toneColor } }, '自動資料確認'),
    h('div', { style: { fontSize: 10, color: C.textSec, lineHeight: 1.7 } }, uiState.summary)
  )
}

/**
 * Holdings Changes Table
 */
export function HoldingsChanges({ changes }) {
  return h(
    Card,
    { style: { marginBottom: 8 } },
    h('div', { style: lbl }, '持倉今日漲跌'),
    changes.map((c, i) =>
      h(
        'div',
        {
          key: c.code,
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '5px 0',
            borderBottom: i < changes.length - 1 ? `1px solid ${C.borderSub}` : 'none',
          },
        },
        h(
          'div',
          null,
          h('span', { style: { fontSize: 12, fontWeight: 500, color: C.text } }, c.name),
          h('span', { style: { fontSize: 9, color: C.textMute, marginLeft: 5 } }, c.code),
          c.type !== '股票' &&
            h(
              'span',
              {
                style: {
                  fontSize: 9,
                  marginLeft: 5,
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: C.amberBg,
                  color: C.amber,
                },
              },
              c.type
            )
        ),
        h(
          'div',
          {
            style: { textAlign: 'right', display: 'flex', gap: 12, alignItems: 'center' },
          },
          h('span', { style: { fontSize: 11, color: C.textMute } }, c.price?.toLocaleString()),
          h(
            'span',
            {
              style: {
                fontSize: 12,
                fontWeight: 600,
                color: c.changePct != null ? pc(c.changePct) : C.textSec,
                minWidth: 55,
                textAlign: 'right',
              },
            },
            c.changePct != null ? `${c.changePct >= 0 ? '+' : ''}${c.changePct.toFixed(2)}%` : '—'
          ),
          h(
            'span',
            {
              style: {
                fontSize: 10,
                color: pc(c.todayPnl),
                minWidth: 50,
                textAlign: 'right',
              },
            },
            `${c.todayPnl >= 0 ? '+' : ''}${c.todayPnl.toLocaleString()}`
          )
        )
      )
    )
  )
}

/**
 * Anomalies Section
 */
export function AnomaliesSection({ anomalies }) {
  if (!anomalies || anomalies.length === 0) return null

  return h(
    Card,
    {
      style: { marginBottom: 8, borderLeft: `3px solid ${alpha(C.amber, '40')}` },
    },
    h('div', { style: { ...lbl, color: C.amber } }, `異常波動 (>3%)`),
    anomalies.map((a) =>
      h(
        'div',
        {
          key: a.code,
          style: { display: 'flex', justifyContent: 'space-between', padding: '6px 0' },
        },
        h('span', { style: { fontSize: 12, color: C.text } }, a.name),
        h(
          'span',
          {
            style: { fontSize: 12, fontWeight: 600, color: pc(a.changePct) },
          },
          `${a.changePct >= 0 ? '+' : ''}${a.changePct.toFixed(2)}%`
        )
      )
    )
  )
}

/**
 * Event Correlations Section
 */
export function EventCorrelations({ correlations }) {
  if (!correlations || correlations.length === 0) return null

  return h(
    Card,
    {
      style: { marginBottom: 8, borderLeft: `3px solid ${alpha(C.teal, '40')}` },
    },
    h('div', { style: { ...lbl, color: C.teal } }, '事件連動分析'),
    correlations.map((ec) =>
      h(
        'div',
        {
          key: ec.id,
          style: { marginBottom: 10, background: C.subtle, borderRadius: 7, padding: '9px 11px' },
        },
        h(
          'div',
          { style: { fontSize: 11, fontWeight: 500, color: C.text, marginBottom: 4 } },
          ec.title
        ),
        h('div', { style: { fontSize: 10, color: C.textMute, marginBottom: 6 } }, ec.date),
        ec.relatedStocks.map((s) =>
          h(
            'div',
            {
              key: s.code,
              style: { display: 'flex', justifyContent: 'space-between', padding: '3px 0' },
            },
            h('span', { style: { fontSize: 10, color: C.textSec } }, s.name),
            h(
              'span',
              {
                style: { fontSize: 10, fontWeight: 600, color: pc(s.changePct) },
              },
              `${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`
            )
          )
        )
      )
    )
  )
}

/**
 * AI Event Assessments Section
 */
export function EventAssessments({
  assessments,
  newsEvents,
  onNavigate,
  onNavigateExpand = () => {},
}) {
  if (!assessments || assessments.length === 0) return null

  return h(
    Card,
    {
      style: { marginBottom: 8, borderLeft: `3px solid ${alpha(C.blue, '40')}` },
    },
    h('div', { style: { ...lbl, color: C.blue } }, `AI 事件評估 · ${assessments.length}件`),
    assessments.map((ea, i) => {
      const impactColor =
        ea.todayImpact === 'positive' ? C.up : ea.todayImpact === 'negative' ? C.down : C.textMute
      const impactLabel =
        ea.todayImpact === 'positive'
          ? '正面'
          : ea.todayImpact === 'negative'
            ? '負面'
            : ea.todayImpact === 'neutral'
              ? '中性'
              : '無關'

      return h(
        'div',
        {
          key: ea.eventId || i,
          style: { marginBottom: 8, background: C.subtle, borderRadius: 7, padding: '9px 11px' },
        },
        h(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 4,
            },
          },
          h('span', { style: { fontSize: 11, fontWeight: 500, color: C.text } }, ea.title),
          h(
            'div',
            { style: { display: 'flex', gap: 6, alignItems: 'center' } },
            h(
              'span',
              {
                style: {
                  fontSize: 9,
                  padding: '2px 6px',
                  borderRadius: 3,
                  background: impactColor + '22',
                  color: impactColor,
                  fontWeight: 600,
                },
              },
              impactLabel
            ),
            ea.suggestClose &&
              h(
                'span',
                {
                  style: {
                    fontSize: 9,
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: C.amberBg,
                    color: C.amber,
                    fontWeight: 600,
                  },
                },
                '建議結案'
              )
          )
        ),
        h('div', { style: { fontSize: 10, color: C.textSec, marginBottom: 2 } }, ea.note),
        h(
          'div',
          { style: { display: 'flex', gap: 8, alignItems: 'center' } },
          h(
            'span',
            { style: { fontSize: 9, color: C.textMute } },
            `信心度 ${Math.round((ea.confidence || 0) * 100)}%`
          ),
          ea.suggestClose &&
            ea.suggestCloseReason &&
            h(
              'span',
              {
                style: { fontSize: 9, color: C.amber },
              },
              ea.suggestCloseReason
            )
        ),
        ea.suggestClose &&
          h(
            Button,
            {
              onClick: (ev) => {
                ev.stopPropagation()
                const NE_ = newsEvents || []
                const matched =
                  NE_.find((e2) => String(e2.id) === String(ea.eventId)) ||
                  NE_.find((e2) => e2.title === ea.title)
                onNavigate('news')
                if (matched) onNavigateExpand(matched.id)
              },
              style: {
                marginTop: 4,
                padding: '4px 10px',
                borderRadius: 5,
                border: `1px solid ${alpha(C.olive, '2a')}`,
                background: 'transparent',
                color: C.olive,
                fontSize: 10,
                cursor: 'pointer',
              },
            },
            '前往結案'
          )
      )
    })
  )
}

/**
 * Brain Audit Section
 */
export function BrainAuditSection({ brainAudit }) {
  const sections = [
    { key: 'validatedRules', label: '今天仍成立', color: C.up },
    { key: 'staleRules', label: '需要重看 / 證據還不夠', color: C.amber },
    { key: 'invalidatedRules', label: '今天被證偽', color: C.down },
  ]

  const hasContent = sections.some((s) => (brainAudit?.[s.key] || []).length > 0)
  if (!hasContent) return null

  return h(
    Card,
    {
      style: { marginBottom: 8, borderLeft: `3px solid ${alpha(C.lavender, '40')}` },
    },
    h('div', { style: lbl }, 'AI 幫你回頭檢查'),
    sections.map((section) => {
      const rows = brainAudit?.[section.key] || []
      if (rows.length === 0) return null

      return h(
        'div',
        { key: section.key, style: { marginBottom: 8 } },
        h(
          'div',
          {
            style: { fontSize: 10, color: section.color, fontWeight: 600, marginBottom: 4 },
          },
          `${section.label} · ${rows.length} 條`
        ),
        rows.map((item, idx) =>
          h(
            'div',
            {
              key: `${section.key}-${idx}`,
              style: {
                marginBottom: 6,
                background: C.subtle,
                borderRadius: 7,
                padding: '9px 11px',
              },
            },
            h(
              'div',
              {
                style: { fontSize: 10, fontWeight: 600, color: C.textSec, marginBottom: 3 },
              },
              item.text || item.id || '未命名規則'
            ),
            item.reason &&
              h('div', { style: { fontSize: 10, color: C.textSec, marginBottom: 2 } }, item.reason),
            h(
              'div',
              { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
              item.confidence != null &&
                h(
                  'span',
                  { style: { fontSize: 9, color: C.textMute } },
                  `信心度 ${item.confidence}%`
                ),
              item.lastValidatedAt &&
                h(
                  'span',
                  { style: { fontSize: 9, color: C.textMute } },
                  `上次確認 ${item.lastValidatedAt}`
                ),
              item.staleness &&
                h(
                  'span',
                  { style: { fontSize: 9, color: C.textMute } },
                  `目前情況 ${describeRuleFreshness(item.staleness)}`
                ),
              item.nextStatus &&
                h(
                  'span',
                  { style: { fontSize: 9, color: C.textMute } },
                  `建議轉為 ${item.nextStatus}`
                )
            ),
            (item.evidenceRefs || []).length > 0 &&
              h(
                'div',
                {
                  style: { fontSize: 9, color: C.blue, marginTop: 3 },
                },
                `證據來源：${item.evidenceRefs
                  .slice(0, 3)
                  .map((ref) => ref.label)
                  .join('、')}${item.evidenceRefs.length > 3 ? '…' : ''}`
              )
          )
        )
      )
    })
  )
}

/**
 * Needs Review Section
 */
export function NeedsReviewSection({ needsReview, onNavigate, onExpand }) {
  if (!needsReview || needsReview.length === 0) return null

  return h(
    Card,
    {
      style: { marginBottom: 8, borderLeft: `3px solid ${alpha(C.up, '40')}` },
    },
    h('div', { style: { ...lbl, color: C.up } }, `需要復盤 · ${needsReview.length}件`),
    needsReview.map((e) =>
      h(
        'div',
        { key: e.id, style: { marginBottom: 8 } },
        h('div', { style: { fontSize: 11, fontWeight: 500, color: C.text } }, e.title),
        h(
          'div',
          { style: { fontSize: 10, color: C.textMute } },
          `${e.date} — 預測${e.pred === 'up' ? '看漲' : '看跌'}`
        ),
        h(
          Button,
          {
            onClick: (ev) => {
              ev.stopPropagation()
              onNavigate('news')
              onExpand(e.id)
            },
            style: {
              marginTop: 4,
              padding: '4px 10px',
              borderRadius: 5,
              border: `1px solid ${alpha(C.olive, '2a')}`,
              background: 'transparent',
              color: C.olive,
              fontSize: 10,
              cursor: 'pointer',
            },
          },
          '前往復盤'
        )
      )
    )
  )
}

/**
 * AI Insight Section (with feedback buttons)
 */
export function AIInsightSection({ insight, error, date, time, onFeedback }) {
  if (!insight && !error) return null

  if (insight) {
    return h(
      Card,
      {
        style: { marginBottom: 8, borderLeft: `3px solid ${alpha(C.lavender, '40')}` },
      },
      h(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
          },
        },
        h('div', { style: { ...lbl, color: C.lavender, marginBottom: 0 } }, 'AI 策略分析'),
        h(
          'span',
          {
            style: {
              fontSize: 10,
              color: C.textMute,
              background: C.subtle,
              padding: '2px 8px',
              borderRadius: 4,
            },
          },
          `${date} ${time}`
        )
      ),
      h(Md, { text: insight, color: C.textSec }),
      // Feedback buttons
      h(
        'div',
        {
          style: {
            display: 'flex',
            gap: 8,
            marginTop: 10,
            paddingTop: 8,
            borderTop: `1px solid ${C.borderSub}`,
          },
        },
        h(
          'span',
          { style: { fontSize: 10, color: C.textMute, alignSelf: 'center' } },
          '這次分析有幫助嗎？'
        ),
        h(
          Button,
          {
            onClick: () => onFeedback && onFeedback('helpful'),
            style: {
              padding: '4px 10px',
              borderRadius: 5,
              border: `1px solid ${alpha(C.up, '30')}`,
              background: alpha(C.up, '10'),
              color: C.up,
              fontSize: 14,
              cursor: 'pointer',
              lineHeight: 1,
            },
          },
          '👍'
        ),
        h(
          Button,
          {
            onClick: () => onFeedback && onFeedback('misleading'),
            style: {
              padding: '4px 10px',
              borderRadius: 5,
              border: `1px solid ${alpha(C.down, '30')}`,
              background: alpha(C.down, '10'),
              color: C.down,
              fontSize: 14,
              cursor: 'pointer',
              lineHeight: 1,
            },
          },
          '👎'
        )
      )
    )
  }

  return h(
    Card,
    {
      style: { marginBottom: 10, background: C.subtle },
    },
    h(
      'div',
      {
        style: { fontSize: 11, color: C.textMute, textAlign: 'center', padding: '8px 0' },
      },
      'AI 分析未產生',
      error ? `：${error}` : '：請確認本地 AI API 金鑰與後端設定'
    )
  )
}

/**
 * Morning Note Section — auto-assembled daily trading memo
 */
export function MorningNoteSection({ morningNote }) {
  if (!morningNote) return null
  const { sections } = morningNote

  const hasContent =
    sections.todayEvents?.length > 0 ||
    sections.holdingStatus?.length > 0 ||
    sections.watchlistAlerts?.length > 0 ||
    sections.announcements?.length > 0

  if (!hasContent) return null

  return h(
    Card,
    {
      style: { marginBottom: 10, borderLeft: `3px solid ${alpha(C.teal, '40')}` },
    },
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
        { style: { ...lbl, color: C.teal, marginBottom: 0 } },
        `每日交易備忘 — ${morningNote.date}`
      )
    ),

    // Today events
    sections.todayEvents?.length > 0 &&
      h(
        'div',
        { style: { marginBottom: 8 } },
        h(
          'div',
          { style: { fontSize: 10, color: C.textSec, fontWeight: 600, marginBottom: 4 } },
          '今日事件'
        ),
        sections.todayEvents.map((e, i) =>
          h(
            'div',
            {
              key: i,
              style: {
                fontSize: 11,
                color: C.text,
                padding: '3px 0',
                display: 'flex',
                gap: 6,
                alignItems: 'center',
              },
            },
            e.impactLabel &&
              h(
                'span',
                {
                  style: {
                    fontSize: 9,
                    padding: '1px 5px',
                    borderRadius: 3,
                    fontWeight: 600,
                    background:
                      e.impactLabel === 'HIGH'
                        ? alpha(C.down, '22')
                        : e.impactLabel === 'MEDIUM'
                          ? C.amberBg
                          : alpha(C.textMute, '15'),
                    color:
                      e.impactLabel === 'HIGH'
                        ? C.down
                        : e.impactLabel === 'MEDIUM'
                          ? C.amber
                          : C.textMute,
                  },
                },
                e.impactLabel
              ),
            h('span', null, e.title),
            e.relatedPillars?.length > 0 &&
              h('span', { style: { fontSize: 9, color: C.teal } }, '投資主軸觀察點')
          )
        )
      ),

    // Holding status with thesis scorecard
    sections.holdingStatus?.length > 0 &&
      h(
        'div',
        { style: { marginBottom: 8 } },
        h(
          'div',
          { style: { fontSize: 10, color: C.textSec, fontWeight: 600, marginBottom: 4 } },
          '持倉概況'
        ),
        sections.holdingStatus.map((s) =>
          h(
            'div',
            {
              key: s.code,
              style: {
                fontSize: 11,
                color: C.text,
                padding: '3px 0',
                display: 'flex',
                justifyContent: 'space-between',
              },
            },
            h(
              'span',
              null,
              `${s.name} `,
              s.conviction &&
                h(
                  'span',
                  { style: { fontSize: 9, color: C.blue, fontWeight: 600 } },
                  s.conviction.toUpperCase()
                )
            ),
            h(
              'span',
              { style: { fontSize: 10, color: C.textMute } },
              s.pillarSummary || '',
              s.stopLossDistance != null && ` 距停損 +${s.stopLossDistance.toFixed(1)}%`
            )
          )
        )
      ),

    // Watchlist alerts
    sections.watchlistAlerts?.length > 0 &&
      h(
        'div',
        { style: { marginBottom: 8 } },
        h(
          'div',
          { style: { fontSize: 10, color: C.textSec, fontWeight: 600, marginBottom: 4 } },
          '觀察股提示'
        ),
        sections.watchlistAlerts.map((w) =>
          h(
            'div',
            { key: w.code, style: { fontSize: 11, color: C.up, padding: '3px 0' } },
            `${w.name}(${w.code}) 接近進場價 ${w.entryPrice}（距離 ${w.distance >= 0 ? '+' : ''}${w.distance.toFixed(1)}%）`
          )
        )
      ),

    // Announcements
    sections.announcements?.length > 0 &&
      h(
        'div',
        null,
        h(
          'div',
          { style: { fontSize: 10, color: C.textSec, fontWeight: 600, marginBottom: 4 } },
          '重大訊息'
        ),
        sections.announcements.map((a, i) =>
          h(
            'div',
            { key: i, style: { fontSize: 11, color: C.text, padding: '3px 0' } },
            `${a.code} ${a.name}：${a.title}`
          )
        )
      )
  )
}

/**
 * Main Daily Report Panel
 */
export function DailyReportPanel({
  morningNote,
  dailyReport,
  analysisHistory = [],
  analyzing,
  analyzeStep,
  stressResult,
  stressTesting,
  dailyExpanded,
  setDailyExpanded,
  runDailyAnalysis,
  runStressTest,
  closeStressResult,
  newsEvents,
  setTab,
  setExpandedNews,
  maybeAutoConfirmDailyReport,
  expandedStock: _expandedStock,
  setExpandedStock: _setExpandedStock,
  strategyBrain: _strategyBrain,
  staleStatus = 'fresh',
  operatingContext = null,
}) {
  const [autoConfirmState, setAutoConfirmState] = useState(null)

  // Feedback handler - stores to localStorage
  function handleFeedback(signal) {
    try {
      if (!dailyReport?.id) return
      appendKnowledgeFeedback({
        analysisId: dailyReport.id,
        signal,
        date: dailyReport.date,
        injectedKnowledgeIds: Array.isArray(dailyReport.injectedKnowledgeIds)
          ? dailyReport.injectedKnowledgeIds
          : [],
      })
    } catch {
      // silent fail
    }
  }

  const liveNeedsReview = buildDailyEventCollections({
    newsEvents,
    isClosedEvent,
    changes: [],
    today: toSlashDate(),
  }).needsReview
  const hasPendingReview = Array.isArray(liveNeedsReview) && liveNeedsReview.length > 0
  const isPreliminaryReport = dailyReport?.analysisStage === 't0-preliminary'

  useEffect(() => {
    let active = true
    if (
      !dailyReport ||
      dailyReport.analysisStage !== 't0-preliminary' ||
      typeof maybeAutoConfirmDailyReport !== 'function'
    ) {
      return () => {
        active = false
      }
    }

    Promise.resolve()
      .then(() => {
        if (active) setAutoConfirmState({ status: 'checking' })
        return maybeAutoConfirmDailyReport(dailyReport)
      })
      .then((result) => {
        if (!active) return
        if (!result || result.status === 'triggered' || result.status === 'skipped') {
          setAutoConfirmState(null)
          return
        }
        setAutoConfirmState(result)
      })
      .catch(() => {
        if (active) setAutoConfirmState({ status: 'error' })
      })

    return () => {
      active = false
    }
  }, [dailyReport, maybeAutoConfirmDailyReport])

  const navigateToNeedsReview = () => {
    if (typeof setTab === 'function') setTab('news')
    const firstId = liveNeedsReview[0]?.id
    if (firstId && typeof setExpandedNews === 'function') {
      setExpandedNews(new Set([firstId]))
    }
  }

  return h(
    'div',
    null,
    h(OperatingContextCard, { context: operatingContext }),
    h(
      'div',
      {
        style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
      },
      h('div', { style: { fontSize: 10, color: C.textMute, fontWeight: 600 } }, '資料狀態'),
      h(StaleBadge, { status: staleStatus, title: 'daily panel freshness' })
    ),
    // Morning note (always shown when available)
    h(MorningNoteSection, { morningNote }),

    // Empty state
    !dailyReport &&
      !analyzing &&
      hasPendingReview &&
      h(ReviewGateCard, {
        pendingReviewItems: liveNeedsReview,
        onNavigateReview: navigateToNeedsReview,
        actionLabel: '開始分析',
      }),

    !dailyReport &&
      !analyzing &&
      h(DailyAnalysisEmpty, {
        onAnalyze: runDailyAnalysis,
        onStressTest: runStressTest,
        analyzing,
        stressTesting,
        analyzeLabel: hasPendingReview ? '仍要分析' : '開始今日收盤分析',
      }),

    // Analyzing state
    analyzing && h(AnalyzingState, { step: analyzeStep }),

    // Stress result
    stressResult && h(StressResult, { result: stressResult, onClose: closeStressResult }),

    // Daily report
    dailyReport &&
      h(
        'div',
        null,
        hasPendingReview &&
          h(ReviewGateCard, {
            pendingReviewItems: liveNeedsReview,
            onNavigateReview: navigateToNeedsReview,
            actionLabel: '重新分析',
          }),

        h(AnalysisStageCard, { report: dailyReport }),
        h(RitualModeCard, { report: dailyReport }),
        isPreliminaryReport && !analyzing && h(AutoConfirmCard, { state: autoConfirmState }),
        h(SameDayDiffCard, { report: dailyReport, analysisHistory }),
        h(WeeklyExportNarrativeCard, { report: dailyReport }),

        h(DailyReportSummary, {
          report: dailyReport,
          expanded: dailyExpanded,
          onToggle: () => setDailyExpanded((p) => !p),
        }),

        h(
          Button,
          {
            onClick: (ev) => {
              ev.stopPropagation()
              runDailyAnalysis()
            },
            disabled: analyzing,
            style: {
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${analyzing ? C.border : alpha(C.blue, '2a')}`,
              background: analyzing ? C.subtle : C.cardBlue,
              color: analyzing ? C.textMute : C.blue,
              fontSize: 11,
              fontWeight: 600,
              cursor: analyzing ? 'not-allowed' : 'pointer',
              marginBottom: 8,
            },
          },
          analyzing
            ? analyzeStep || '分析中...'
            : hasPendingReview
              ? '仍要重新分析'
              : isPreliminaryReport
                ? '跑資料確認版'
                : '重新分析今日收盤'
        ),
        h(
          Button,
          {
            onClick: (ev) => {
              ev.stopPropagation()
              setTab('research')
            },
            style: {
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${alpha(C.teal, '2a')}`,
              background: alpha(C.teal, '12'),
              color: C.teal,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: 8,
            },
          },
          '前往深度研究'
        ),

        dailyExpanded &&
          h(
            'div',
            null,
            h(HoldingsChanges, { changes: dailyReport.changes }),
            h(AnomaliesSection, { anomalies: dailyReport.anomalies }),
            h(EventCorrelations, { correlations: dailyReport.eventCorrelations }),
            h(EventAssessments, {
              assessments: dailyReport.eventAssessments,
              newsEvents,
              onNavigate: setTab,
              onNavigateExpand: (id) => setExpandedNews(new Set([id])),
            }),
            h(BrainAuditSection, { brainAudit: dailyReport.brainAudit }),
            h(NeedsReviewSection, {
              needsReview: dailyReport.needsReview,
              onNavigate: setTab,
              onExpand: (id) => setExpandedNews(new Set([id])),
            }),
            h(AIInsightSection, {
              insight: dailyReport.aiInsight,
              error: dailyReport.aiError,
              date: dailyReport.date,
              time: dailyReport.time,
              onFeedback: handleFeedback,
            })
          )
      )
  )
}
