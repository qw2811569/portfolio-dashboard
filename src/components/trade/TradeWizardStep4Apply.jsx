import { C } from '../../theme.js'
import { Button, Card } from '../common'

export default function TradeWizardStep4Apply({ result, onReset }) {
  return (
    <Card style={{ borderRadius: 8, borderLeft: `3px solid ${C.up}` }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 4 }}>
        STEP 4 套用
      </div>
      <div
        data-testid="trade-wizard-applied"
        style={{ color: C.textSec, fontSize: 13, lineHeight: 1.7 }}
      >
        已寫入 {result?.entries?.length || 0} 筆 tradeLog，holdings 已更新。
      </div>
      <Button onClick={onReset} style={{ marginTop: 12, width: '100%' }}>
        新增下一筆
      </Button>
    </Card>
  )
}
