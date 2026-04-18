import { createElement as h } from 'react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'

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
    return h('span', { style: { fontSize: 10, color: 'var(--muted)' } }, '—')
  }

  return h(
    'div',
    {
      style: {
        width: 80,
        height: 28,
        flex: '0 0 auto',
      },
      'aria-label': 'holding sparkline',
    },
    h(
      ResponsiveContainer,
      { width: '100%', height: '100%' },
      h(
        LineChart,
        { data },
        h(Tooltip, {
          formatter: (value) => [value, '收盤'],
          labelFormatter: (label) => label,
          contentStyle: { fontSize: 10, padding: '4px 6px' },
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
  )
}
