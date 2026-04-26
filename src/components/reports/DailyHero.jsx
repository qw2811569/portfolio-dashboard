import { C, alpha } from '../../theme.js'
import { Button, Card } from '../common'

export default function DailyHero({ hero, copyText }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(copyText || hero?.text || '')
    } catch {
      // Clipboard is best-effort in embedded browsers.
    }
  }

  return (
    <Card
      data-testid="daily-ritual-hero"
      style={{ borderRadius: 8, borderLeft: `3px solid ${C.up}` }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: C.textMute, fontWeight: 700 }}>今日盤後</div>
          <div style={{ color: C.text, fontSize: 18, fontWeight: 800, marginTop: 4 }}>
            {hero?.waiting ? '等明早' : 'Streaming 摘要'}
          </div>
        </div>
        <Button data-testid="daily-copy-summary" onClick={handleCopy}>
          複製今日摘要
        </Button>
      </div>
      <div
        style={{
          marginTop: 12,
          padding: '12px 12px',
          borderRadius: 8,
          background: alpha(C.fillTeal, '10'),
          color: C.textSec,
          fontSize: 14,
          lineHeight: 1.8,
          whiteSpace: 'pre-wrap',
        }}
      >
        {hero?.text}
      </div>
    </Card>
  )
}
