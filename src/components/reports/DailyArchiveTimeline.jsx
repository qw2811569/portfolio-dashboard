import { C, alpha } from '../../theme.js'
import { Button, Card } from '../common'

export default function DailyArchiveTimeline({ items = [], selectedDate = '', onSelect }) {
  if (!items.length) return null

  return (
    <Card data-testid="daily-archive-timeline" style={{ borderRadius: 8 }}>
      <div style={{ color: C.text, fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
        7 天 archive
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {items.map((item) => {
          const active = item.date === selectedDate
          return (
            <Button
              key={item.id}
              onClick={() => onSelect?.(item.date)}
              style={{
                borderRadius: 999,
                background: active ? alpha(C.fillTeal, '24') : C.subtle,
                border: `1px solid ${active ? alpha(C.fillTeal, '45') : C.border}`,
                color: active ? C.text : C.textSec,
              }}
            >
              {item.date.slice(5) || item.date}
            </Button>
          )
        })}
      </div>
    </Card>
  )
}
