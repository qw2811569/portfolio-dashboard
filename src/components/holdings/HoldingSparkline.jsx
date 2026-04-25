import { createElement as h } from 'react'
import { LineChart, Line, Tooltip } from 'recharts'

const SPARKLINE_WIDTH = 80
const SPARKLINE_HEIGHT = 28

function toCloseNumber(point) {
  const raw = point?.close ?? point?.price ?? point?.value ?? point?.close_price ?? null
  const close = Number(raw)
  return Number.isFinite(close) ? close : null
}

export function normalizeHoldingSparklineHistory(history = []) {
  return (Array.isArray(history) ? history : [])
    .map((point, index) => {
      const close = toCloseNumber(point)
      if (close == null) return null

      return {
        date: point?.date || point?.day || point?.trading_date || `point-${index}`,
        close,
      }
    })
    .filter(Boolean)
    .slice(-30)
}

export function getHoldingSparklineTrend(history = []) {
  const data = normalizeHoldingSparklineHistory(history)
  if (data.length < 5) return null

  return data[data.length - 1].close >= data[0].close ? 'var(--up)' : 'var(--down)'
}

export default function HoldingSparkline({ history = [], color = 'var(--up)' }) {
  const data = normalizeHoldingSparklineHistory(history)
  const trend = getHoldingSparklineTrend(data)

  if (!trend) {
    return h(
      'span',
      { style: { fontSize: 12, color: 'var(--text-sec, var(--charcoal, #2f3232))' } },
      '—'
    )
  }

  return h(
    'div',
    {
      style: {
        width: SPARKLINE_WIDTH,
        height: SPARKLINE_HEIGHT,
        flex: '0 0 auto',
      },
      'aria-hidden': 'true',
    },
    h(
      LineChart,
      {
        width: SPARKLINE_WIDTH,
        height: SPARKLINE_HEIGHT,
        data,
        accessibilityLayer: false,
        'aria-hidden': 'true',
        focusable: false,
        tabIndex: -1,
      },
      h(Tooltip, {
        formatter: (value) => [value, '收盤'],
        labelFormatter: (label) => label,
        contentStyle: { fontSize: 12, padding: '4px 8px' },
      }),
      h(Line, {
        type: 'monotone',
        dataKey: 'close',
        stroke: trend || color,
        strokeWidth: 1.5,
        dot: false,
        isAnimationActive: false,
      })
    )
  )
}
