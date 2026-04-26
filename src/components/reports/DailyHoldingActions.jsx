import { C, alpha } from '../../theme.js'
import { Card } from '../common'

const actionTone = {
  加碼: C.textSec,
  續抱: C.textSec,
  觀察: C.iron,
  減碼: C.textSec,
  減碼分批: C.textSec,
  減碼或停損: C.down,
  出場: C.down,
}

export default function DailyHoldingActions({ actions = [] }) {
  if (!actions.length) return null

  return (
    <Card data-testid="daily-holding-actions" style={{ borderRadius: 8 }}>
      <div style={{ color: C.text, fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
        每檔今日該做
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {actions.map((item) => {
          const color = actionTone[item.action] || C.textSec
          return (
            <div
              key={`${item.code}-${item.action}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: 10,
                alignItems: 'center',
                border: `1px solid ${C.border}`,
                background: C.subtle,
                borderRadius: 8,
                padding: '9px 10px',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ color: C.text, fontSize: 12, fontWeight: 800 }}>
                  {`${item.name} ${item.code}`.trim()}
                </div>
                <div style={{ color: C.textMute, fontSize: 12, marginTop: 3 }}>{item.reason}</div>
              </div>
              <div
                style={{
                  color,
                  background: alpha(color, '12'),
                  border: `1px solid ${alpha(color, '25')}`,
                  borderRadius: 8,
                  padding: '5px 9px',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {item.action}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
