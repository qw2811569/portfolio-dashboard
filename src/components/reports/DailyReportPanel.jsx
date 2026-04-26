import { createElement as h, useEffect, useMemo, useState } from 'react'
import { C, alpha } from '../../theme.js'
import {
  AccuracyGateBlock,
  Card,
  Button,
  Badge,
  MarkdownText,
  OperatingContextCard,
  StaleBadge,
} from '../common'
import { resolveDailyAccuracyGate } from '../../lib/accuracyGateUi.js'
import { buildDailyEventCollections } from '../../lib/dailyAnalysisRuntime.js'
import { buildSameDayDailyReportDiff } from '../../lib/dailyReportDiff.js'
import { isClosedEvent, toSlashDate } from '../../lib/eventUtils.js'
import { pfKey, readStorageValue } from '../../lib/portfolioUtils.js'
import { normalizeAnalysisHistoryEntries } from '../../lib/reportUtils.js'
import { getViewModeComplianceMessage, isViewModeEnabled } from '../../lib/viewModeContract.js'
import { composeDailyReportRitual } from '../../lib/dailyReportComposer.js'
import DailyHero from './DailyHero.jsx'
import DailyPillars from './DailyPillars.jsx'
import DailyHoldingActions from './DailyHoldingActions.jsx'
import DailyArchiveTimeline from './DailyArchiveTimeline.jsx'
import DailyHitRateChart from './DailyHitRateChart.jsx'

const lbl = {
  fontSize: 12,
  color: C.textMute,
  letterSpacing: '0.06em',
  fontWeight: 600,
  marginBottom: 4,
}

const pc = (p) => (p == null ? C.textMute : p >= 0 ? C.up : C.down)

function describeRuleFreshness(status) {
  if (status === 'fresh') return '資料還算新'
  if (status === 'aging') return '資料有點舊'
  if (status === 'stale') return '資料太久沒更新'
  if (status === 'missing') return '資料還不夠'
  return status || ''
}

function resolveDailyPanelFreshnessLabel(status) {
  if (status === 'fresh') return '資料正常'
  if (status === 'aging') return '資料有點舊'
  if (status === 'stale') return '資料需更新'
  if (status === 'missing') return '資料還在補'
  if (status === 'failed') return '同步失敗'
  return ''
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

function classifyHoldingHealth(item = null) {
  const summary = String(item?.pillarSummary || '')
    .trim()
    .toLowerCase()

  if (/broken|invalidated/.test(summary)) return 'broken'
  if (/watch|behind|weakened/.test(summary)) return 'weakened'
  return 'intact'
}

function summarizeHoldingStatus(items = []) {
  return (Array.isArray(items) ? items : []).reduce(
    (summary, item) => {
      summary.totalStocks += 1
      const tone = classifyHoldingHealth(item)
      if (tone === 'broken') summary.brokenCount += 1
      else if (tone === 'weakened') summary.weakenedCount += 1
      else summary.intactCount += 1
      return summary
    },
    {
      totalStocks: 0,
      intactCount: 0,
      weakenedCount: 0,
      brokenCount: 0,
    }
  )
}

function summarizeDailyChanges(changes = []) {
  return (Array.isArray(changes) ? changes : []).reduce(
    (summary, change) => {
      summary.totalStocks += 1
      const pnl = Number(change?.todayPnl) || 0
      const changePct = Number(change?.changePct)
      summary.totalTodayPnl += pnl
      if (Number.isFinite(changePct) && changePct < 0) summary.negativeCount += 1
      else if (Number.isFinite(changePct) && changePct > 0) summary.positiveCount += 1
      else summary.flatCount += 1
      return summary
    },
    {
      totalStocks: 0,
      positiveCount: 0,
      negativeCount: 0,
      flatCount: 0,
      totalTodayPnl: 0,
    }
  )
}

function ComplianceNoteCard({ note, role }) {
  if (!note) return null

  return h(
    Card,
    {
      role,
      'data-testid': 'viewmode-compliance-note',
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(C.amber, '40')}`,
      },
    },
    h('div', { style: { ...lbl, color: C.textSec } }, '合規顯示模式'),
    h('div', { style: { fontSize: 12, color: C.textSec, lineHeight: 1.7 } }, note)
  )
}

function AggregateDailySummary({
  title = '組合摘要',
  subtitle = '',
  totalStocks = 0,
  intactCount = 0,
  weakenedCount = 0,
  brokenCount = 0,
  positiveCount = 0,
  negativeCount = 0,
  flatCount = 0,
  totalTodayPnl = null,
  compact = false,
  testId = 'aggregate-daily-summary',
}) {
  const Container = compact ? 'div' : Card
  const containerStyle = compact
    ? {
        padding: '8px 8px',
        borderRadius: 8,
        background: C.subtle,
        border: `1px solid ${C.borderSub}`,
      }
    : {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(C.amber, '40')}`,
      }
  const statItems = [
    totalStocks > 0 ? `追蹤 ${totalStocks} 檔` : null,
    intactCount > 0 ? `維持 ${intactCount}` : null,
    weakenedCount > 0 ? `轉弱 ${weakenedCount}` : null,
    brokenCount > 0 ? `失真 ${brokenCount}` : null,
    positiveCount > 0 ? `上漲 ${positiveCount}` : null,
    negativeCount > 0 ? `下跌 ${negativeCount}` : null,
    flatCount > 0 ? `持平 ${flatCount}` : null,
  ].filter(Boolean)

  return h(
    Container,
    {
      'data-testid': testId,
      style: containerStyle,
    },
    h('div', { style: { ...lbl, color: C.textSec, marginBottom: 4 } }, title),
    subtitle &&
      h(
        'div',
        {
          style: {
            fontSize: 12,
            color: C.textSec,
            lineHeight: 1.7,
            marginBottom: statItems.length > 0 || totalTodayPnl != null ? 8 : 0,
          },
        },
        subtitle
      ),
    statItems.length > 0 &&
      h(
        'div',
        {
          style: {
            display: 'flex',
            gap: 4,
            flexWrap: 'wrap',
            marginBottom: totalTodayPnl != null ? 8 : 0,
          },
        },
        ...statItems.map((item) =>
          h(
            'span',
            {
              key: item,
              style: {
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 999,
                background: alpha(C.amber, '12'),
                border: `1px solid ${alpha(C.amber, '20')}`,
                color: C.textSec,
              },
            },
            item
          )
        )
      ),
    totalTodayPnl != null &&
      h(
        'div',
        {
          style: {
            fontSize: 12,
            color: pc(totalTodayPnl),
            fontWeight: 600,
            fontFamily: 'var(--font-num)',
          },
        },
        `組合今日損益 ${totalTodayPnl >= 0 ? '+' : ''}${totalTodayPnl.toLocaleString()}`
      )
  )
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
      badgeColor: 'positive',
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
      style: { textAlign: 'center', padding: '16px 12px', marginBottom: 8 },
    },
    h('div', { style: { fontSize: 24, marginBottom: 4, opacity: 0.4 } }, '◎'),
    h(
      'div',
      { style: { fontSize: 12, color: C.textSec, fontWeight: 500, marginBottom: 4 } },
      '每日收盤分析'
    ),
    h(
      'div',
      { style: { fontSize: 12, color: C.textMute, marginBottom: 12, lineHeight: 1.6 } },
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
            padding: '8px 24px',
            borderRadius: 8,
            border: 'none',
            background: C.cta,
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
            padding: '8px 16px',
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
        stressTesting ? '測試中...' : '風險壓力測試'
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
    h(
      'div',
      { style: { ...lbl, color: C.textSec } },
      `待復盤事件 · ${pendingReviewItems.length}件`
    ),
    h(
      'div',
      { style: { fontSize: 12, color: C.textSec, lineHeight: 1.7, marginBottom: 8 } },
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
            padding: '8px 12px',
            borderRadius: 8,
            border: `1px solid ${alpha(C.iron, '2a')}`,
            background: alpha(C.iron, '12'),
            color: C.textSec,
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
            fontSize: 12,
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
        padding: '48px 16px',
        background: alpha(C.ink, '08'),
      },
    },
    // Spinning loader
    h('div', {
      style: {
        width: 36,
        height: 36,
        margin: '0 auto 16px',
        border: `3px solid ${alpha(C.ink, '20')}`,
        borderTop: `3px solid ${C.ink}`,
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
          marginBottom: 8,
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
          color: C.textSec,
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
          background: C.ink,
          borderRadius: 2,
          animation: 'indeterminate 1.8s ease-in-out infinite',
        },
      })
    ),
    h(
      'div',
      {
        style: {
          fontSize: 12,
          color: C.textMute,
          marginTop: 8,
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
        `風險壓力測試 · ${result.date}`
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
        { style: { display: 'flex', alignItems: 'center', gap: 4 } },
        h('div', { style: { ...lbl, marginBottom: 0 } }, `${report.date} 收盤分析`),
        h('span', { style: { fontSize: 11, color: C.textMute } }, report.time),
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
        h('span', { style: { fontSize: 11, color: C.textMute } }, expanded ? '▲' : '▼')
      )
    ),
    // Analysis stats (shown when expanded)
    expanded &&
      h(
        'div',
        {
          style: {
            marginTop: 8,
            paddingTop: 8,
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
          },
        },
        h('div', { style: { fontSize: 11, color: C.textSec } }, `引用 ${eventCount} 個事件`),
        h('div', { style: { fontSize: 11, color: C.textSec } }, `${knowledgeCount} 條知識庫規則`),
        h('div', { style: { fontSize: 11, color: C.textSec } }, `${finmindCount} 筆 FinMind 數據`),
        h('div', { style: { fontSize: 11, color: C.textSec } }, stageMeta.summary)
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
          stageMeta.badgeColor === 'positive' ? alpha(C.positive, '40') : alpha(C.amber, '40')
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
          marginBottom: 4,
        },
      },
      h('div', { style: { ...lbl, color: C.textSec } }, '資料確認階段'),
      h(Badge, { color: stageMeta.badgeColor }, report.analysisStageLabel || '既有版本')
    ),
    h('div', { style: { fontSize: 12, color: C.textSec, lineHeight: 1.7 } }, stageMeta.summary),
    pendingCodes.length > 0 &&
      h(
        'div',
        { style: { fontSize: 11, color: C.textMute, marginTop: 4, lineHeight: 1.7 } },
        `待確認標的：${pendingCodes.slice(0, 5).join('、')}${pendingCodes.length > 5 ? '…' : ''}`
      ),
    report.rerunReason === 'finmind-confirmed' &&
      h(
        'div',
        { style: { fontSize: 11, color: C.textSec, marginTop: 4 } },
        '這份分析是由同日快版升級而來，已保留先前版本供追蹤。'
      ),
    report.rerunReason === 'finmind-auto-confirmed' &&
      h(
        'div',
        { style: { fontSize: 11, color: C.textSec, marginTop: 4 } },
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
        borderLeft: `3px solid ${alpha(C.iron, '40')}`,
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
          marginBottom: 4,
        },
      },
      h('div', { style: { ...lbl, color: C.textSec } }, ritualMode?.label || '收盤後儀式模式'),
      h(Badge, { color: 'iron' }, card?.title || '明日動作卡')
    ),
    h(
      'div',
      { style: { fontSize: 12, color: C.textSec, lineHeight: 1.7, marginBottom: 8 } },
      '流程固定為：同步收盤價 -> 回看今日偏差 -> 排定明日動作，避免隔天開盤前又重新猜一次。'
    ),
    immediateActions.length > 0 &&
      h(
        'div',
        { style: { marginBottom: watchlist.length > 0 || notes.length > 0 ? 8 : 0 } },
        h(
          'div',
          { style: { fontSize: 12, color: C.textSec, fontWeight: 600, marginBottom: 4 } },
          '明日立即執行'
        ),
        immediateActions.map((item, index) =>
          h(
            'div',
            {
              key: `ritual-immediate-${index}`,
              style: {
                fontSize: 12,
                color: C.text,
                lineHeight: 1.7,
                padding: '4px 0',
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
          { style: { fontSize: 12, color: C.textSec, fontWeight: 600, marginBottom: 4 } },
          '觀察清單'
        ),
        watchlist.map((item, index) =>
          h(
            'div',
            {
              key: `ritual-watch-${index}`,
              style: {
                fontSize: 12,
                color: C.text,
                lineHeight: 1.7,
                padding: '4px 0',
              },
            },
            `- ${item}`
          )
        )
      ),
    (card?.summary || notes.length > 0) &&
      h(
        'div',
        { style: { fontSize: 11, color: C.textMute, lineHeight: 1.7 } },
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
        borderLeft: `3px solid ${alpha(C.ink, '40')}`,
      },
    },
    h('div', { style: { ...lbl, color: C.textSec } }, '週報匯出內容'),
    h(
      'div',
      { style: { fontSize: 12, color: C.textSec, lineHeight: 1.7 } },
      '從上方複製週報素材時，會一併附上「本週敘事」；若組合處於合規壓縮模式，也會自動補上合規備註。'
    )
  )
}

function DiffValue({ value, format = 'text' }) {
  if (format === 'markdown') {
    return h(
      'div',
      {
        style: {
          fontSize: 12,
          color: C.text,
          lineHeight: 1.7,
        },
      },
      h(MarkdownText, { text: String(value || '').trim() || '無', color: C.text })
    )
  }

  return h(
    'div',
    {
      style: {
        fontSize: 12,
        color: C.text,
        lineHeight: 1.7,
        whiteSpace: 'pre-wrap',
      },
    },
    String(value || '').trim() || '無'
  )
}

export function SameDayDiffCard({ report, analysisHistory = [], viewMode = 'retail' }) {
  const [diffOpen, setDiffOpen] = useState(false)
  const diff = useMemo(
    () =>
      buildSameDayDailyReportDiff({
        currentReport: report,
        analysisHistory,
      }),
    [analysisHistory, report]
  )
  const isInsiderCompressed = viewMode === 'insider-compressed'

  if (!diff) return null

  const toggleLabel = diffOpen
    ? '收起差異'
    : diff.changeCount > 0
      ? '展開差異（t0 快版 vs t1 確認版）'
      : '本日無差異 · 查看確認說明'

  return h(
    Card,
    {
      'data-testid': 'daily-diff-card',
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(diff.changeCount > 0 ? C.ink : C.positive, '40')}`,
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
          marginBottom: 4,
        },
      },
      h(
        'div',
        { style: { display: 'grid', gap: 4 } },
        h(
          'div',
          { style: { ...lbl, color: diff.changeCount > 0 ? C.ink : C.positive } },
          '同日版本差異'
        ),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' } },
          h(
            Badge,
            { color: diff.changeCount > 0 ? 'iron' : 'positive' },
            diff.changeCount > 0 ? `${diff.changeCount} 項更新` : '本日無差異'
          ),
          h(
            Badge,
            { color: 'default' },
            `${diff.previousReport.analysisStageLabel || '收盤快版'} -> ${diff.currentReport.analysisStageLabel || '資料確認版'}`
          )
        )
      ),
      h(
        Button,
        {
          'data-testid': 'daily-diff-toggle',
          'aria-controls': 'daily-diff-pane',
          'aria-expanded': diffOpen,
          color: diff.changeCount > 0 ? 'positive' : 'iron',
          onClick: () => setDiffOpen((value) => !value),
          style: {
            padding: '10px 12px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1.4,
            whiteSpace: 'normal',
            textAlign: 'center',
          },
        },
        toggleLabel
      )
    ),
    h(
      'div',
      { style: { fontSize: 12, color: C.textSec, lineHeight: 1.7, marginBottom: 8 } },
      diff.summary
    ),
    diff.rerunReasonLabel &&
      h(
        'div',
        {
          style: {
            fontSize: 11,
            color: C.textMute,
            lineHeight: 1.7,
            marginBottom: diffOpen ? 8 : 0,
          },
        },
        `確認說明：${diff.rerunReasonLabel}`
      ),
    diffOpen &&
      h(
        'section',
        {
          id: 'daily-diff-pane',
          className: 'diff-pane',
          'data-testid': 'daily-diff-pane',
          style: {
            display: 'grid',
            gap: 8,
          },
        },
        isInsiderCompressed
          ? h(
              'p',
              {
                style: {
                  margin: 0,
                  fontSize: 12,
                  color: C.textSec,
                  lineHeight: 1.8,
                },
              },
              diff.changeCount > 0
                ? 't0/t1 只顯示組合層級差異，不展開個股細節'
                : '本日 t0 與 t1 無實質差異，且只保留組合層級說明'
            )
          : diff.changes.length > 0
            ? h(
                'ul',
                {
                  style: {
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                    display: 'grid',
                    gap: 8,
                  },
                },
                ...diff.changes.map((change) =>
                  h(
                    'li',
                    {
                      key: change.key,
                      style: {
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        padding: 8,
                        background: alpha(C.bg, '0d'),
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
                        'span',
                        { className: 'diff-label', style: { ...lbl, marginBottom: 0 } },
                        change.field
                      ),
                      change.rerunReason &&
                        h(
                          'span',
                          {
                            className: 'diff-reason',
                            style: {
                              fontSize: 11,
                              color: C.textMute,
                            },
                          },
                          change.rerunReason
                        )
                    ),
                    h(
                      'div',
                      {
                        style: {
                          display: 'grid',
                          gridTemplateColumns: '1fr auto 1fr',
                          gap: 8,
                          alignItems: 'start',
                        },
                      },
                      h(
                        'div',
                        {
                          className: 'diff-old',
                          style: {
                            borderRadius: 8,
                            padding: 8,
                            background: alpha(C.textMute, '10'),
                          },
                        },
                        h(
                          'div',
                          { style: { ...lbl, marginBottom: 4, color: C.textMute } },
                          't0 快版'
                        ),
                        h(DiffValue, { value: change.t0Value, format: change.format })
                      ),
                      h(
                        'span',
                        {
                          className: 'diff-arrow',
                          style: {
                            alignSelf: 'center',
                            fontSize: 14,
                            color: C.textMute,
                          },
                        },
                        '→'
                      ),
                      h(
                        'div',
                        {
                          className: 'diff-new',
                          style: {
                            borderRadius: 8,
                            padding: 8,
                            background: alpha(C.ink, '10'),
                          },
                        },
                        h(
                          'div',
                          { style: { ...lbl, marginBottom: 4, color: C.textSec } },
                          't1 確認版'
                        ),
                        h(DiffValue, { value: change.t1Value, format: change.format })
                      )
                    )
                  )
                )
              )
            : h(
                'p',
                {
                  style: {
                    margin: 0,
                    fontSize: 12,
                    color: C.textMute,
                    lineHeight: 1.7,
                  },
                },
                '本日 t0 與 t1 無實質差異 · 收盤快版結論穩定'
              )
      )
  )
}

function buildAutoConfirmUiState(state = null) {
  switch (state?.status) {
    case 'checking':
      return {
        tone: 'iron',
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
    uiState.tone === 'iron' ? C.iron : uiState.tone === 'amber' ? C.amber : C.textMute

  return h(
    Card,
    {
      style: {
        marginBottom: 8,
        borderLeft: `3px solid ${
          uiState.tone === 'iron'
            ? alpha(C.iron, '40')
            : uiState.tone === 'amber'
              ? alpha(C.amber, '40')
              : alpha(C.textMute, '35')
        }`,
      },
    },
    h('div', { style: { ...lbl, color: toneColor } }, '自動資料確認'),
    h('div', { style: { fontSize: 12, color: C.textSec, lineHeight: 1.7 } }, uiState.summary)
  )
}

/**
 * Holdings Changes Table
 */
export function HoldingsChanges({ changes, viewMode = 'retail' }) {
  const showPerStockDiff = isViewModeEnabled('showPerStockDiff', viewMode)
  if (!showPerStockDiff) {
    const summary = summarizeDailyChanges(changes)
    return h(AggregateDailySummary, {
      title: '持倉今日變化',
      subtitle: '合規壓縮模式下只保留組合層級漲跌摘要。',
      ...summary,
      totalTodayPnl: summary.totalTodayPnl,
    })
  }

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
            padding: '4px 0',
            borderBottom: i < changes.length - 1 ? `1px solid ${C.borderSub}` : 'none',
          },
        },
        h(
          'div',
          null,
          h('span', { style: { fontSize: 12, fontWeight: 500, color: C.text } }, c.name),
          h('span', { style: { fontSize: 11, color: C.textMute, marginLeft: 4 } }, c.code),
          c.type !== '股票' &&
            h(
              'span',
              {
                style: {
                  fontSize: 11,
                  marginLeft: 4,
                  padding: '4px 8px',
                  borderRadius: 3,
                  background: C.amberBg,
                  color: C.textSec,
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
                fontSize: 12,
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
export function AnomaliesSection({ anomalies, viewMode = 'retail' }) {
  if (!anomalies || anomalies.length === 0) return null
  if (!isViewModeEnabled('showPerStockDiff', viewMode)) {
    return h(AggregateDailySummary, {
      title: '異常波動',
      subtitle: '個股異常已壓縮為組合層級統計。',
      totalStocks: anomalies.length,
      positiveCount: anomalies.filter((item) => (item?.changePct || 0) > 0).length,
      negativeCount: anomalies.filter((item) => (item?.changePct || 0) < 0).length,
      flatCount: anomalies.filter((item) => !Number(item?.changePct)).length,
    })
  }

  return h(
    Card,
    {
      style: { marginBottom: 8, borderLeft: `3px solid ${alpha(C.amber, '40')}` },
    },
    h('div', { style: { ...lbl, color: C.textSec } }, `異常波動 (>3%)`),
    anomalies.map((a) =>
      h(
        'div',
        {
          key: a.code,
          style: { display: 'flex', justifyContent: 'space-between', padding: '4px 0' },
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
export function EventCorrelations({ correlations, viewMode = 'retail' }) {
  if (!correlations || correlations.length === 0) return null
  if (!isViewModeEnabled('showPerStockDiff', viewMode)) {
    const relatedStocks = new Set(
      correlations.flatMap((item) =>
        Array.isArray(item?.relatedStocks) ? item.relatedStocks.map((stock) => stock?.code) : []
      )
    )
    return h(AggregateDailySummary, {
      title: '事件連動分析',
      subtitle: '事件關聯已壓縮為組合層級摘要。',
      totalStocks: relatedStocks.size,
      positiveCount: correlations.filter((item) =>
        (item?.relatedStocks || []).some((stock) => (stock?.changePct || 0) > 0)
      ).length,
      negativeCount: correlations.filter((item) =>
        (item?.relatedStocks || []).some((stock) => (stock?.changePct || 0) < 0)
      ).length,
      flatCount: correlations.length,
    })
  }

  return h(
    Card,
    {
      style: { marginBottom: 8, borderLeft: `3px solid ${alpha(C.ink, '40')}` },
    },
    h('div', { style: { ...lbl, color: C.textSec } }, '事件連動分析'),
    correlations.map((ec) =>
      h(
        'div',
        {
          key: ec.id,
          style: { marginBottom: 8, background: C.subtle, borderRadius: 7, padding: '8px 8px' },
        },
        h(
          'div',
          { style: { fontSize: 11, fontWeight: 500, color: C.text, marginBottom: 4 } },
          ec.title
        ),
        h('div', { style: { fontSize: 12, color: C.textMute, marginBottom: 4 } }, ec.date),
        ec.relatedStocks.map((s) =>
          h(
            'div',
            {
              key: s.code,
              style: { display: 'flex', justifyContent: 'space-between', padding: '4px 0' },
            },
            h('span', { style: { fontSize: 12, color: C.textSec } }, s.name),
            h(
              'span',
              {
                style: { fontSize: 12, fontWeight: 600, color: pc(s.changePct) },
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
      style: { marginBottom: 8, borderLeft: `3px solid ${alpha(C.ink, '40')}` },
    },
    h('div', { style: { ...lbl, color: C.textSec } }, `AI 事件評估 · ${assessments.length}件`),
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
          style: { marginBottom: 8, background: C.subtle, borderRadius: 7, padding: '8px 8px' },
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
            { style: { display: 'flex', gap: 4, alignItems: 'center' } },
            h(
              'span',
              {
                style: {
                  fontSize: 11,
                  padding: '4px 8px',
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
                    fontSize: 11,
                    padding: '4px 8px',
                    borderRadius: 3,
                    background: C.amberBg,
                    color: C.textSec,
                    fontWeight: 600,
                  },
                },
                '建議結案'
              )
          )
        ),
        h('div', { style: { fontSize: 12, color: C.textSec, marginBottom: 4 } }, ea.note),
        h(
          'div',
          { style: { display: 'flex', gap: 8, alignItems: 'center' } },
          h(
            'span',
            { style: { fontSize: 11, color: C.textMute } },
            `信心度 ${Math.round((ea.confidence || 0) * 100)}%`
          ),
          ea.suggestClose &&
            ea.suggestCloseReason &&
            h(
              'span',
              {
                style: { fontSize: 11, color: C.textSec },
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
                padding: '4px 8px',
                borderRadius: 5,
                border: `1px solid ${alpha(C.iron, '2a')}`,
                background: 'transparent',
                color: C.textSec,
                fontSize: 12,
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
    { key: 'validatedRules', label: '今天仍成立', color: C.textSec },
    { key: 'staleRules', label: '需要重看 / 證據還不夠', color: C.textSec },
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
            style: { fontSize: 12, color: section.color, fontWeight: 600, marginBottom: 4 },
          },
          `${section.label} · ${rows.length} 條`
        ),
        rows.map((item, idx) =>
          h(
            'div',
            {
              key: `${section.key}-${idx}`,
              style: {
                marginBottom: 4,
                background: C.subtle,
                borderRadius: 7,
                padding: '8px 8px',
              },
            },
            h(
              'div',
              {
                style: { fontSize: 12, fontWeight: 600, color: C.textSec, marginBottom: 4 },
              },
              item.text || item.id || '未命名規則'
            ),
            item.reason &&
              h('div', { style: { fontSize: 12, color: C.textSec, marginBottom: 4 } }, item.reason),
            h(
              'div',
              { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
              item.confidence != null &&
                h(
                  'span',
                  { style: { fontSize: 11, color: C.textMute } },
                  `信心度 ${item.confidence}%`
                ),
              item.lastValidatedAt &&
                h(
                  'span',
                  { style: { fontSize: 11, color: C.textMute } },
                  `上次確認 ${item.lastValidatedAt}`
                ),
              item.staleness &&
                h(
                  'span',
                  { style: { fontSize: 11, color: C.textMute } },
                  `目前情況 ${describeRuleFreshness(item.staleness)}`
                ),
              item.nextStatus &&
                h(
                  'span',
                  { style: { fontSize: 11, color: C.textMute } },
                  `建議轉為 ${item.nextStatus}`
                )
            ),
            (item.evidenceRefs || []).length > 0 &&
              h(
                'div',
                {
                  style: { fontSize: 11, color: C.textSec, marginTop: 4 },
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
    h('div', { style: { ...lbl, color: C.textSec } }, `需要復盤 · ${needsReview.length}件`),
    needsReview.map((e) =>
      h(
        'div',
        { key: e.id, style: { marginBottom: 8 } },
        h('div', { style: { fontSize: 11, fontWeight: 500, color: C.text } }, e.title),
        h(
          'div',
          { style: { fontSize: 12, color: C.textMute } },
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
              padding: '4px 8px',
              borderRadius: 5,
              border: `1px solid ${alpha(C.iron, '2a')}`,
              background: 'transparent',
              color: C.textSec,
              fontSize: 12,
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
export function AIInsightSection({
  insight,
  error,
  date,
  time,
  onFeedback,
  accuracyGate = null,
  onRetry = null,
  onDismiss = null,
}) {
  if (accuracyGate) {
    return h(AccuracyGateBlock, {
      reason: accuracyGate.reason,
      resource: accuracyGate.resource,
      context: accuracyGate.context,
      onRetry,
      onDismiss,
    })
  }

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
              fontSize: 12,
              color: C.textMute,
              background: C.subtle,
              padding: '4px 8px',
              borderRadius: 4,
            },
          },
          `${date} ${time}`
        )
      ),
      h(MarkdownText, { text: insight, color: C.textSec }),
      // Feedback buttons
      h(
        'div',
        {
          style: {
            display: 'flex',
            gap: 8,
            marginTop: 8,
            paddingTop: 8,
            borderTop: `1px solid ${C.borderSub}`,
          },
        },
        h(
          'span',
          { style: { fontSize: 12, color: C.textMute, alignSelf: 'center' } },
          '這次分析有幫助嗎？'
        ),
        h(
          Button,
          {
            onClick: () => onFeedback && onFeedback('helpful'),
            style: {
              padding: '4px 8px',
              borderRadius: 5,
              border: `1px solid ${alpha(C.up, '30')}`,
              background: alpha(C.up, '10'),
              color: C.textSec,
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
              padding: '4px 8px',
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
      style: { marginBottom: 8, background: C.subtle },
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
export function MorningNoteSection({ morningNote, viewMode = 'retail' }) {
  if (!morningNote) return null
  const { sections } = morningNote
  const showPerStockDiff = isViewModeEnabled('showPerStockDiff', viewMode)

  const hasContent =
    sections.todayEvents?.length > 0 ||
    sections.holdingStatus?.length > 0 ||
    sections.watchlistAlerts?.length > 0 ||
    sections.announcements?.length > 0

  if (!hasContent) return null

  return h(
    Card,
    {
      style: { marginBottom: 8, borderLeft: `3px solid ${alpha(C.ink, '40')}` },
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
        { style: { ...lbl, color: C.textSec, marginBottom: 0 } },
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
          { style: { fontSize: 12, color: C.textSec, fontWeight: 600, marginBottom: 4 } },
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
                padding: '4px 0',
                display: 'flex',
                gap: 4,
                alignItems: 'center',
              },
            },
            e.impactLabel &&
              h(
                'span',
                {
                  style: {
                    fontSize: 11,
                    padding: '4px 8px',
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
              h('span', { style: { fontSize: 11, color: C.textSec } }, '投資主軸觀察點')
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
          { style: { fontSize: 12, color: C.textSec, fontWeight: 600, marginBottom: 4 } },
          '持倉概況'
        ),
        showPerStockDiff
          ? sections.holdingStatus.map((s) =>
              h(
                'div',
                {
                  key: s.code,
                  'data-testid': `morning-note-holding-${s.code}`,
                  style: {
                    fontSize: 11,
                    color: C.text,
                    padding: '4px 0',
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
                      { style: { fontSize: 11, color: C.textSec, fontWeight: 600 } },
                      s.conviction.toUpperCase()
                    )
                ),
                h(
                  'span',
                  { style: { fontSize: 12, color: C.textMute } },
                  s.pillarSummary || '',
                  s.stopLossDistance != null && ` 距停損 +${s.stopLossDistance.toFixed(1)}%`
                )
              )
            )
          : h(AggregateDailySummary, {
              compact: true,
              title: '持倉概況',
              subtitle: '合規壓縮模式下只保留組合層級狀態。',
              ...summarizeHoldingStatus(sections.holdingStatus),
            })
      ),

    // Watchlist alerts
    sections.watchlistAlerts?.length > 0 &&
      h(
        'div',
        { style: { marginBottom: 8 } },
        h(
          'div',
          { style: { fontSize: 12, color: C.textSec, fontWeight: 600, marginBottom: 4 } },
          '觀察股提示'
        ),
        sections.watchlistAlerts.map((w) =>
          h(
            'div',
            { key: w.code, style: { fontSize: 11, color: C.text, padding: '4px 0' } },
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
          { style: { fontSize: 12, color: C.textSec, fontWeight: 600, marginBottom: 4 } },
          '重大訊息'
        ),
        sections.announcements.map((a, i) =>
          h(
            'div',
            { key: i, style: { fontSize: 11, color: C.text, padding: '4px 0' } },
            `${a.code} ${a.name}：${a.title}`
          )
        )
      )
  )
}

function resolvePersistedAnalysisHistory(portfolioId) {
  const normalizedPortfolioId = String(portfolioId || '').trim()
  if (!normalizedPortfolioId || typeof localStorage === 'undefined') return []
  return normalizeAnalysisHistoryEntries(
    readStorageValue(pfKey(normalizedPortfolioId, 'analysis-history-v1'))
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
  viewMode = 'retail',
}) {
  const [autoConfirmState, setAutoConfirmState] = useState(null)
  const [selectedArchiveDate, setSelectedArchiveDate] = useState('')
  const isInsiderCompressed = viewMode === 'insider-compressed'
  const complianceNote = isInsiderCompressed
    ? '這是合規壓縮版 · 僅保留組合層級觀察 · 不顯示個股細節'
    : getViewModeComplianceMessage(viewMode, operatingContext?.portfolioLabel || '')

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
  const dailyAccuracyGate = useMemo(
    () =>
      resolveDailyAccuracyGate({
        report: dailyReport,
        staleStatus,
        viewMode,
        autoConfirmState,
      }),
    [autoConfirmState, dailyReport, staleStatus, viewMode]
  )
  const resolvedAnalysisHistory = useMemo(() => {
    const normalized = Array.isArray(analysisHistory)
      ? normalizeAnalysisHistoryEntries(analysisHistory)
      : []
    if (normalized.length > 0) return normalized
    if (!dailyReport) return normalized
    return resolvePersistedAnalysisHistory(operatingContext?.portfolio?.id)
  }, [analysisHistory, dailyReport, operatingContext?.portfolio?.id])
  const dailyRitual = useMemo(
    () =>
      composeDailyReportRitual({
        dailyReport,
        analysisHistory: resolvedAnalysisHistory,
        selectedDate: selectedArchiveDate,
      }),
    [dailyReport, resolvedAnalysisHistory, selectedArchiveDate]
  )
  const selectedRitualDate = selectedArchiveDate || dailyRitual.hero.date
  const dailyAccuracyGateKey = dailyAccuracyGate
    ? [
        dailyAccuracyGate.resource,
        dailyAccuracyGate.reason,
        dailyReport?.id || dailyReport?.date || '',
      ]
        .filter(Boolean)
        .join(':')
    : ''
  const [dismissedAccuracyGateKey, setDismissedAccuracyGateKey] = useState('')
  const showDailyAccuracyGate = Boolean(
    dailyAccuracyGate && dismissedAccuracyGateKey !== dailyAccuracyGateKey
  )

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

  const retryDailyAccuracyGate = () => {
    if (isPreliminaryReport && typeof maybeAutoConfirmDailyReport === 'function' && dailyReport) {
      Promise.resolve(maybeAutoConfirmDailyReport(dailyReport))
        .then((result) => {
          if (!result || result.status === 'triggered' || result.status === 'skipped') {
            setAutoConfirmState(null)
            return
          }
          setAutoConfirmState(result)
        })
        .catch(() => {
          setAutoConfirmState({ status: 'error' })
        })
      return
    }

    if (typeof runDailyAnalysis === 'function') runDailyAnalysis()
  }

  return h(
    'div',
    { 'data-testid': 'daily-panel' },
    isInsiderCompressed &&
      h(ComplianceNoteCard, {
        note: complianceNote,
        role: 'top-banner',
      }),
    h(OperatingContextCard, { context: operatingContext }),
    !isInsiderCompressed &&
      isViewModeEnabled('showComplianceNote', viewMode) &&
      h(ComplianceNoteCard, { note: complianceNote }),
    h(
      'div',
      {
        style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
      },
      h('div', { style: { fontSize: 12, color: C.textMute, fontWeight: 600 } }, '資料狀態'),
      h(StaleBadge, {
        status: staleStatus,
        label: resolveDailyPanelFreshnessLabel(staleStatus),
        title: 'daily panel freshness',
      })
    ),
    // Morning note (always shown when available)
    h(MorningNoteSection, { morningNote, viewMode }),

    h(
      'div',
      {
        style: {
          display: 'grid',
          gap: 8,
          marginBottom: 8,
        },
      },
      h(DailyHero, { hero: dailyRitual.hero, copyText: dailyRitual.copyText }),
      h(DailyPillars, { pillars: dailyRitual.pillars }),
      viewMode !== 'insider-compressed' &&
        h(DailyHoldingActions, { actions: dailyRitual.holdingActions }),
      h(DailyArchiveTimeline, {
        items: dailyRitual.archive,
        selectedDate: selectedRitualDate,
        onSelect: setSelectedArchiveDate,
      }),
      h(DailyHitRateChart, { rows: dailyRitual.hitRows })
    ),

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
        h(SameDayDiffCard, {
          report: dailyReport,
          analysisHistory: resolvedAnalysisHistory,
          viewMode,
        }),
        h(WeeklyExportNarrativeCard, { report: dailyReport }),

        h(DailyReportSummary, {
          report: dailyReport,
          expanded: dailyExpanded,
          onToggle: () => setDailyExpanded((p) => !p),
        }),

        h(
          Button,
          {
            'data-testid': 'run-daily-analysis-btn',
            onClick: (ev) => {
              ev.stopPropagation()
              runDailyAnalysis()
            },
            disabled: analyzing,
            style: {
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: `1px solid ${analyzing ? C.border : alpha(C.cta, '2a')}`,
              background: analyzing ? C.subtle : alpha(C.cta, '12'),
              color: analyzing ? C.textMute : C.textSec,
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
            'data-testid': 'go-research-btn',
            onClick: (ev) => {
              ev.stopPropagation()
              setTab('research')
            },
            style: {
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: `1px solid ${alpha(C.positive, '2a')}`,
              background: alpha(C.positive, '12'),
              color: C.textSec,
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
            h(HoldingsChanges, { changes: dailyReport.changes, viewMode }),
            h(AnomaliesSection, { anomalies: dailyReport.anomalies, viewMode }),
            h(EventCorrelations, { correlations: dailyReport.eventCorrelations, viewMode }),
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
              accuracyGate: showDailyAccuracyGate ? dailyAccuracyGate : null,
              onRetry: retryDailyAccuracyGate,
              onDismiss: () => setDismissedAccuracyGateKey(dailyAccuracyGateKey),
            })
          )
      )
  )
}
