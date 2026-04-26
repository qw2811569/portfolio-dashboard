import { C } from '../../theme.js'
import { Button, Card } from '../common'

const inputStyle = {
  width: '100%',
  background: C.subtle,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: '8px 9px',
  color: C.text,
  fontSize: 12,
  fontFamily: 'inherit',
}

export default function TradeWizardStep2Parse({
  trades = [],
  onChangeTrade,
  onNext,
  onBack,
  hasUnconfirmedActions = false,
}) {
  const nextBlockReason = hasUnconfirmedActions ? '請先確認所有未指定動作的交易' : ''

  return (
    <Card data-testid="trade-parse-results" style={{ borderRadius: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 4 }}>
        STEP 2 解析
      </div>
      <div style={{ color: C.textMute, fontSize: 12, marginBottom: 12 }}>
        待確認交易可逐欄編輯，確認代碼、方向、股數與成交價後再預覽。
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {trades.map((trade, index) => (
          <div
            key={`${trade.code}-${index}`}
            data-testid="trade-wizard-trade-row"
            style={{
              display: 'grid',
              gridTemplateColumns: '88px 1fr 1fr 1fr 1fr',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <select
              aria-label={`第 ${index + 1} 筆方向`}
              style={inputStyle}
              value={trade.action}
              onChange={(event) =>
                // Only an explicit direction change clears this warning; qty/price edits keep it visible.
                onChangeTrade(index, {
                  action: event.target.value,
                  confidence: 'medium',
                  needsActionConfirmation: false,
                })
              }
            >
              <option value="買進">買進</option>
              <option value="賣出">賣出</option>
            </select>
            <input
              aria-label={`第 ${index + 1} 筆代碼`}
              style={inputStyle}
              value={trade.code}
              onChange={(event) => onChangeTrade(index, { code: event.target.value })}
            />
            <input
              aria-label={`第 ${index + 1} 筆名稱`}
              style={inputStyle}
              value={trade.name}
              onChange={(event) => onChangeTrade(index, { name: event.target.value })}
            />
            <input
              aria-label={`第 ${index + 1} 筆股數`}
              style={inputStyle}
              type="number"
              value={trade.qty}
              onChange={(event) => onChangeTrade(index, { qty: Number(event.target.value) })}
            />
            <input
              aria-label={`第 ${index + 1} 筆成交價`}
              style={inputStyle}
              type="number"
              value={trade.price}
              onChange={(event) => onChangeTrade(index, { price: Number(event.target.value) })}
            />
            {trade.needsActionConfirmation ? (
              <div
                data-testid="trade-action-warning"
                style={{
                  gridColumn: '1 / -1',
                  color: C.down,
                  fontSize: 12,
                  fontWeight: 700,
                  lineHeight: 1.5,
                }}
              >
                未指定動作，請確認這筆是買進或賣出。
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Button onClick={onBack}>返回上傳</Button>
        <Button
          data-testid="trade-wizard-to-preview"
          onClick={onNext}
          disabled={!trades.length || hasUnconfirmedActions}
          title={nextBlockReason}
          variant="filled"
          style={{ flex: 1 }}
        >
          跳過備忘，先看預覽
        </Button>
      </div>
    </Card>
  )
}
