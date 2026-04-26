import { C, alpha } from '../../theme.js'
import { Button, Card } from '../common'

function toDateInputValue(value = '') {
  const normalized = String(value || '').replace(/\//g, '-')
  return /^\d{4}-\d{2}-\d{2}$/u.test(normalized) ? normalized : ''
}

function fromDateInputValue(value = '') {
  return String(value || '').replace(/-/g, '/')
}

export default function DailyArchiveTimeline({ items = [], selectedDate = '', onSelect }) {
  if (!items.length) return null
  const quickItems = items.slice(0, 7)
  const selectedInputDate = toDateInputValue(selectedDate)

  return (
    <Card data-testid="daily-archive-timeline" style={{ borderRadius: 8 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 8,
        }}
      >
        <div style={{ color: C.text, fontSize: 13, fontWeight: 800 }}>7 天 archive</div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: C.textMute,
            fontSize: 12,
          }}
        >
          搜尋特定日
          <input
            data-testid="daily-archive-date-input"
            type="date"
            value={selectedInputDate}
            min={toDateInputValue(items[items.length - 1]?.date)}
            max={toDateInputValue(items[0]?.date)}
            onChange={(event) => {
              const nextDate = fromDateInputValue(event.target.value)
              if (items.some((item) => item.date === nextDate)) onSelect?.(nextDate)
            }}
            style={{
              minHeight: 32,
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.bg,
              color: C.text,
              fontSize: 12,
              padding: '4px 8px',
            }}
          />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {quickItems.map((item) => {
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
      {items.length > quickItems.length && (
        <div style={{ marginTop: 8, fontSize: 11, color: C.textMute, lineHeight: 1.6 }}>
          已建立 {items.length} 天索引，較早日期可用日曆切換。
        </div>
      )}
    </Card>
  )
}
