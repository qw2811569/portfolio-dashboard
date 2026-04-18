import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { C } from '../../theme.js'
import { getHoldingMarketValue } from '../../lib/holdings.js'

const RING_COLORS = [
  'var(--positive)',
  'var(--up)',
  C.choco,
  'var(--muted)',
  'var(--warning)',
  'var(--positive-soft)',
]

export default function HoldingsRing({ holdings = [], totalVal = 0 }) {
  const rows = (Array.isArray(holdings) ? holdings : [])
    .map((holding) => {
      const value = Number(holding?.value) || getHoldingMarketValue(holding)
      return {
        code: String(holding?.code || '').trim(),
        name: String(holding?.name || holding?.code || '未命名持倉').trim(),
        value,
      }
    })
    .filter((holding) => holding.code && holding.value > 0)
    .sort((a, b) => b.value - a.value)

  const total = totalVal > 0 ? totalVal : rows.reduce((sum, holding) => sum + holding.value, 0)
  const topFive = rows.slice(0, 5).map((holding) => ({
    ...holding,
    weight: total > 0 ? holding.value / total : 0,
  }))
  const otherRows = rows.slice(5)
  const otherValue = otherRows.reduce((sum, holding) => sum + holding.value, 0)
  const chartData =
    otherValue > 0 ? [...topFive, { code: 'OTHER', name: '其他', value: otherValue }] : topFive

  return (
    <div
      style={{
        display: 'grid',
        gap: 18,
        height: '100%',
      }}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        <div
          style={{
            fontSize: 14,
            color: C.textMute,
            fontFamily: 'var(--font-body)',
          }}
        >
          持倉結構
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.textMute,
            lineHeight: 1.6,
          }}
        >
          依市值占比分布，快速看出資金集中在哪些標的。
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          height: 260,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={100}
              stroke="none"
              paddingAngle={chartData.length > 1 ? 2 : 0}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={entry.code || entry.name}
                  fill={RING_COLORS[index % RING_COLORS.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ textAlign: 'center', display: 'grid', gap: 4 }}>
            <div
              style={{
                fontSize: 11,
                color: C.textMute,
                letterSpacing: '0.08em',
              }}
            >
              TOTAL
            </div>
            <div
              className="tn"
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: C.text,
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              {Math.round(total).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {topFive.map((holding, index) => (
          <div
            key={holding.code}
            style={{
              display: 'grid',
              gridTemplateColumns: '12px minmax(0, 1fr) auto',
              gap: 10,
              alignItems: 'center',
              fontSize: 12,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: RING_COLORS[index % RING_COLORS.length],
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: C.text,
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {holding.name}
              </div>
              <div style={{ color: C.textMute, marginTop: 2 }}>{holding.code}</div>
            </div>
            <div className="tn" style={{ color: C.textSec, fontWeight: 600 }}>
              {(holding.weight * 100).toFixed(1)}%
            </div>
          </div>
        ))}

        {otherRows.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '12px minmax(0, 1fr) auto',
              gap: 10,
              alignItems: 'center',
              fontSize: 12,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: RING_COLORS[topFive.length % RING_COLORS.length],
              }}
            />
            <div style={{ color: C.textMute }}>{`其他 ${otherRows.length} 檔`}</div>
            <div className="tn" style={{ color: C.textSec, fontWeight: 600 }}>
              {total > 0 ? `${((otherValue / total) * 100).toFixed(1)}%` : '0.0%'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
