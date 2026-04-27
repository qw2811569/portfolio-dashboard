import { createElement as h, useMemo, useState } from 'react'
import { buildAnxietyMetrics } from '../../lib/anxietyMetrics.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'
import { Badge, Button, Card, Skeleton, SoftMessage } from '../common/index.js'
import { C, alpha } from '../../theme.js'

const panelLabelStyle = {
  fontSize: 12,
  color: C.textMute,
  letterSpacing: '0.12em',
  fontWeight: 700,
  textTransform: 'uppercase',
}

const toneMeta = {
  ok: {
    badge: 'positive',
    border: alpha(C.positive, '26'),
    background: alpha(C.surface, 'f8'),
    accent: C.positive,
  },
  warn: {
    badge: 'warning',
    border: alpha(C.warning, '30'),
    background: alpha(C.surface, 'f8'),
    accent: C.warning,
  },
  alert: {
    badge: 'alert',
    border: alpha(C.hot, '28'),
    background: alpha(C.surface, 'f8'),
    accent: C.cta,
  },
  muted: {
    badge: 'mute',
    border: alpha(C.iron, '26'),
    background: alpha(C.surface, 'f8'),
    accent: C.iron,
  },
}

function MetricIcon({ id, accent }) {
  const commonProps = {
    width: 18,
    height: 18,
    viewBox: '0 0 18 18',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': 'true',
  }
  const strokeProps = {
    stroke: accent,
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  if (id === 'x1') {
    return h(
      'svg',
      commonProps,
      h('path', {
        ...strokeProps,
        d: 'M2 11.5C4.2 11.5 4.8 6.5 7 6.5C9.2 6.5 9.8 11.5 12 11.5C14.2 11.5 14.8 8 16 8',
      })
    )
  }
  if (id === 'x2') {
    return h(
      'svg',
      commonProps,
      h('path', {
        ...strokeProps,
        d: 'M9 2.5L15 5.5V9.5C15 12.7 12.8 15.5 9 16C5.2 15.5 3 12.7 3 9.5V5.5L9 2.5Z',
      }),
      h('path', { ...strokeProps, d: 'M6.5 9L8.2 10.7L11.8 7.1' })
    )
  }
  if (id === 'x3') {
    return h(
      'svg',
      commonProps,
      h('path', { ...strokeProps, d: 'M2.5 12.5L5.2 9.8L8.1 11.1L11.2 6.7L15.5 8.2' }),
      h('path', { ...strokeProps, d: 'M15.5 8.2V12.7' })
    )
  }
  if (id === 'x4') {
    return h(
      'svg',
      commonProps,
      h('rect', { ...strokeProps, x: '2.5', y: '3', width: '5', height: '5' }),
      h('rect', { ...strokeProps, x: '10.5', y: '3', width: '5', height: '5' }),
      h('rect', { ...strokeProps, x: '2.5', y: '10', width: '5', height: '5' }),
      h('rect', { ...strokeProps, x: '10.5', y: '10', width: '5', height: '5' })
    )
  }

  return h(
    'svg',
    commonProps,
    h('path', { ...strokeProps, d: 'M9 3V9L12.5 11.5' }),
    h('circle', { ...strokeProps, cx: '9', cy: '9', r: '6' })
  )
}

function Sparkline({ values = [], tone = 'muted' }) {
  const safeValues = Array.isArray(values)
    ? values.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : []
  if (safeValues.length < 2) return null

  const meta = toneMeta[tone] || toneMeta.muted
  const width = 168
  const height = 42
  const max = Math.max(...safeValues)
  const min = Math.min(...safeValues)
  const range = max - min || 1
  const step = safeValues.length > 1 ? width / (safeValues.length - 1) : width

  const points = safeValues
    .map((value, index) => {
      const x = Math.round(index * step * 100) / 100
      const y = Math.round((height - ((value - min) / range) * (height - 8) - 4) * 100) / 100
      return `${x},${y}`
    })
    .join(' ')

  return h(
    'svg',
    {
      width: '100%',
      height,
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': 'institutional flow sparkline',
      style: {
        display: 'block',
        marginTop: 8,
      },
    },
    h('line', {
      x1: 0,
      x2: width,
      y1: height - 4,
      y2: height - 4,
      stroke: alpha(C.iron, '22'),
      strokeWidth: 1,
    }),
    h('polyline', {
      points,
      fill: 'none',
      stroke: meta.accent,
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    })
  )
}

function resolveMetricDisplay(metric = {}) {
  if (metric.id === 'x5' && Number(metric.eventCount) > 0) {
    return {
      question: '最近一件需要復盤的事？',
      currentValue: metric.supportingValue || '先確認最近一件事件',
      supportingValue: metric.detail || '先看最近一件是否需要調整投資理由。',
    }
  }

  return {
    question: metric.question,
    currentValue: metric.currentValue,
    supportingValue: metric.supportingValue,
  }
}

function MetricCard({ metric, expanded, onToggle, onNavigate, spanFullWidth = false }) {
  const meta = toneMeta[metric?.tone] || toneMeta.muted
  const detailId = `anxiety-metric-detail-${metric.id}`
  const isMetricLoading = metric?.availability === 'loading'
  const isPlaceholder = metric?.availability === 'placeholder'
  const display = resolveMetricDisplay(metric)

  // R156 #3: collapse placeholder/loading cards to a 1-row chip so the dashboard
  // first fold isn't dominated by 3 of 5 cards永遠寫「待補 上線時才有」(R152 #2).
  if (isPlaceholder || isMetricLoading) {
    return h(
      'article',
      {
        'data-testid': `anxiety-metric-card-${metric.id}`,
        'data-availability': metric?.availability,
        'data-compact': 'true',
        style: {
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          borderRadius: 12,
          border: `1px solid ${meta.border}`,
          background: alpha(meta.background, 'a8'),
          gridColumn: spanFullWidth ? '1 / -1' : undefined,
        },
      },
      h(
        'span',
        {
          style: {
            fontSize: 11,
            color: C.textMute,
            letterSpacing: '0.1em',
            fontWeight: 700,
            textTransform: 'uppercase',
          },
        },
        metric.id.toUpperCase()
      ),
      h(
        'span',
        {
          'data-testid': `anxiety-metric-question-${metric.id}`,
          style: { fontSize: 12, color: C.textSec, lineHeight: 1.4, flex: 1, minWidth: 0 },
        },
        display.question
      ),
      h(Badge, { color: meta.badge, size: 'sm' }, isMetricLoading ? '整理中' : '稍後再上')
    )
  }

  return h(
    'article',
    {
      'data-testid': `anxiety-metric-card-${metric.id}`,
      style: {
        minWidth: 0,
        display: 'grid',
        gap: 12,
        padding: '14px 14px 12px',
        borderRadius: C.radii.lg,
        border: `1px solid ${meta.border}`,
        background: meta.background,
        boxShadow: `${C.insetLine}, ${C.shadow}`,
        gridColumn: spanFullWidth ? '1 / -1' : undefined,
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        },
      },
      h(
        'div',
        {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
          },
        },
        h(
          'span',
          {
            style: {
              width: 34,
              height: 34,
              borderRadius: '50%',
              border: `1px solid ${meta.border}`,
              background: alpha(meta.accent, '12'),
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            },
          },
          h(MetricIcon, { id: metric.id, accent: meta.accent })
        ),
        h(
          'div',
          {
            style: {
              minWidth: 0,
              display: 'grid',
              gap: 2,
            },
          },
          h(
            'div',
            {
              style: {
                fontSize: 11,
                color: C.textMute,
                letterSpacing: '0.1em',
                fontWeight: 700,
                textTransform: 'uppercase',
              },
            },
            metric.id.toUpperCase()
          ),
          h(
            'div',
            {
              'data-testid': `anxiety-metric-question-${metric.id}`,
              style: {
                color: C.text,
                fontSize: 14,
                lineHeight: 1.45,
                fontWeight: 700,
              },
            },
            display.question
          )
        )
      ),
      h(
        Badge,
        { color: meta.badge, size: 'sm' },
        isMetricLoading
          ? '整理中'
          : metric.tone === 'ok'
            ? '正常'
            : metric.tone === 'warn'
              ? '留意'
              : metric.tone === 'alert'
                ? '快看'
                : '待補'
      )
    ),
    h(
      'div',
      {
        style: {
          display: 'grid',
          gap: 4,
        },
      },
      isMetricLoading
        ? h(
            'div',
            {
              style: {
                minHeight: 64,
                display: 'grid',
                alignContent: 'start',
              },
            },
            h(Skeleton, { variant: 'text', count: 1 })
          )
        : [
            h(
              'div',
              {
                key: 'current-value',
                style: {
                  color: C.text,
                  fontSize: 'clamp(18px, 2vw, 24px)',
                  lineHeight: 1.1,
                  fontWeight: 700,
                  fontFamily: 'var(--font-num)',
                },
              },
              display.currentValue
            ),
            h(
              'div',
              {
                key: 'supporting-value',
                style: {
                  color: C.textSec,
                  fontSize: 12,
                  lineHeight: 1.6,
                  minHeight: 38,
                },
              },
              display.supportingValue
            ),
          ]
    ),
    Array.isArray(metric.sparkline) && metric.sparkline.length > 1
      ? h(
          'div',
          { 'data-testid': `anxiety-metric-sparkline-${metric.id}` },
          h(Sparkline, { values: metric.sparkline, tone: metric.tone })
        )
      : null,
    metric.availability === 'placeholder'
      ? h(
          SoftMessage,
          {
            tone: 'muted',
            style: {
              minHeight: 0,
              padding: '8px 10px',
            },
          },
          metric.detail
        )
      : null,
    h(
      'button',
      {
        type: 'button',
        'data-testid': `anxiety-metric-toggle-${metric.id}`,
        'aria-expanded': expanded ? 'true' : 'false',
        'aria-controls': detailId,
        onClick: onToggle,
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          width: '100%',
          border: `1px solid ${alpha(C.iron, '22')}`,
          borderRadius: 12,
          background: alpha(C.boneDeep, '72'),
          color: C.textSec,
          padding: '9px 10px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        },
      },
      h('span', null, expanded ? '先收起' : '展開看看'),
      h(
        'span',
        {
          'aria-hidden': 'true',
          style: {
            color: meta.accent,
            fontSize: 14,
          },
        },
        expanded ? '−' : '+'
      )
    ),
    expanded
      ? h(
          'div',
          {
            id: detailId,
            'data-testid': `anxiety-metric-detail-${metric.id}`,
            style: {
              display: 'grid',
              gap: 10,
              borderTop: `1px dashed ${alpha(C.iron, '26')}`,
              paddingTop: 10,
            },
          },
          h(
            'div',
            {
              style: {
                color: C.textSec,
                fontSize: 12,
                lineHeight: 1.7,
              },
            },
            metric.detail
          ),
          typeof onNavigate === 'function' && metric.routeTab
            ? h(
                Button,
                {
                  variant: 'ghost',
                  color: 'default',
                  size: 'sm',
                  onClick: () => onNavigate(metric.routeTab),
                  'data-testid': `anxiety-metric-handoff-${metric.id}`,
                  style: {
                    justifySelf: 'start',
                    textTransform: 'none',
                  },
                },
                metric.routeLabel || '去看細節'
              )
            : null
        )
      : null
  )
}

export function AnxietyMetricsPanel({
  anxietyMetrics = null,
  holdings = [],
  holdingDossiers = [],
  newsEvents = [],
  dailyReport = null,
  stockMeta = null,
  loading = false,
  onNavigate = null,
}) {
  const isMobile = useIsMobile()
  const [expandedId, setExpandedId] = useState('x2')
  const panelState = useMemo(
    () =>
      anxietyMetrics ||
      buildAnxietyMetrics({
        holdings,
        holdingDossiers,
        newsEvents,
        dailyReport,
        stockMeta,
        loading,
      }),
    [anxietyMetrics, dailyReport, holdingDossiers, holdings, loading, newsEvents, stockMeta]
  )
  const metrics = Array.isArray(panelState?.metrics) ? panelState.metrics : []

  if (panelState?.loading) {
    return h(
      Card,
      {
        'data-testid': 'anxiety-metrics-panel',
        style: {
          marginBottom: 12,
        },
      },
      h(
        'div',
        {
          style: {
            display: 'grid',
            gap: 12,
          },
        },
        h('div', { style: panelLabelStyle }, '五個焦慮指標'),
        h(
          'div',
          {
            style: {
              color: C.text,
              fontSize: 22,
              lineHeight: 1.2,
              fontWeight: 700,
            },
          },
          '先把今天要看的五題排好。'
        ),
        h(Skeleton, { variant: 'card', count: 5 })
      )
    )
  }

  if (metrics.length === 0) {
    return h(
      Card,
      {
        'data-testid': 'anxiety-metrics-panel',
        style: {
          marginBottom: 12,
        },
      },
      h(
        'div',
        {
          style: {
            display: 'grid',
            gap: 10,
          },
        },
        h('div', { style: panelLabelStyle }, '五個焦慮指標'),
        h(
          'div',
          {
            style: {
              color: C.text,
              fontSize: 22,
              lineHeight: 1.2,
              fontWeight: 700,
            },
          },
          '今天先把節奏放慢一點。'
        ),
        h(
          SoftMessage,
          {
            tone: 'muted',
            style: {
              minHeight: 0,
            },
          },
          '這五題還沒拿到任何可信資料，先看今晨速報跟待處理事件。'
        )
      )
    )
  }

  return h(
    Card,
    {
      'data-testid': 'anxiety-metrics-panel',
      style: {
        marginBottom: 16,
        background: alpha(C.surface, 'f8'),
      },
    },
    h(
      'div',
      {
        style: {
          display: 'grid',
          gap: 14,
        },
      },
      h(
        'div',
        {
          style: {
            display: 'grid',
            gap: 6,
          },
        },
        h('div', { style: panelLabelStyle }, '五個焦慮指標'),
        h(
          'div',
          {
            style: {
              color: C.text,
              fontSize: 'clamp(22px, 3vw, 30px)',
              lineHeight: 1.1,
              fontWeight: 700,
            },
          },
          '先把 5 個問題攤開，今天就不必每頁來回猜。'
        ),
        h(
          'div',
          {
            style: {
              color: C.textSec,
              fontSize: 13,
              lineHeight: 1.7,
              maxWidth: 760,
            },
          },
          '桌機先掃一排，手機先掃一欄；真的有聲音的那張再點開看。'
        )
      ),
      panelState.placeholderCount || panelState.loadingCount
        ? h(
            SoftMessage,
            {
              tone: 'warning',
              style: {
                minHeight: 0,
              },
            },
            `目前有 ${(panelState.placeholderCount || 0) + (panelState.loadingCount || 0)} 題還在接資料，先把已經到位的放前面。`
          )
        : null,
      h(
        'div',
        {
          'data-testid': 'anxiety-metrics-grid',
          style: {
            display: 'grid',
            gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(5, minmax(0, 1fr))',
            gap: 12,
          },
        },
        metrics.map((metric) =>
          h(MetricCard, {
            key: metric.id,
            metric,
            expanded: expandedId === metric.id,
            onToggle: () => setExpandedId((prev) => (prev === metric.id ? null : metric.id)),
            onNavigate,
            spanFullWidth: isMobile,
          })
        )
      )
    )
  )
}
