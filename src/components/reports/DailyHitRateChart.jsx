import { C, alpha } from '../../theme.js'
import { Card } from '../common'

export default function DailyHitRateChart({ rows = [] }) {
  if (!rows.length) return null
  const max = Math.max(100, ...rows.map((row) => Number(row.rate) || 0))

  return (
    <Card data-testid="daily-hit-rate-chart" style={{ borderRadius: 8 }}>
      <div style={{ color: C.text, fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
        30 天預測命中率
      </div>
      <div style={{ display: 'flex', alignItems: 'end', gap: 4, height: 70 }}>
        {rows.slice(0, 30).map((row, index) => (
          <div
            key={`${row.label}-${index}`}
            title={`${row.label} ${row.rate}%`}
            style={{
              flex: '1 1 0',
              minWidth: 5,
              height: `${Math.max(6, ((Number(row.rate) || 0) / max) * 70)}px`,
              borderRadius: '6px 6px 0 0',
              background: alpha(C.fillTeal, '50'),
            }}
          />
        ))}
      </div>
      <div style={{ marginTop: 8, color: C.textMute, fontSize: 11 }}>
        最近 {rows.length} 筆 · 平均{' '}
        {Math.round(rows.reduce((sum, row) => sum + (Number(row.rate) || 0), 0) / rows.length)}%
      </div>
    </Card>
  )
}
