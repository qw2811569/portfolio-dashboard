import { C } from '../../theme.js'
import { Card } from '../common'

export default function DailyPillars({ pillars = [] }) {
  return (
    <div
      data-testid="daily-pillars"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 8,
      }}
    >
      {pillars.map((pillar) => (
        <Card key={pillar.key} style={{ borderRadius: 8, padding: '12px 12px' }}>
          <div style={{ color: C.text, fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
            {pillar.title}
          </div>
          <div style={{ color: C.textSec, fontSize: 12, lineHeight: 1.65 }}>{pillar.body}</div>
        </Card>
      ))}
    </div>
  )
}
