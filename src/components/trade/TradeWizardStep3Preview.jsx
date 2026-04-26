import { C, alpha } from '../../theme.js'
import { Button, Card } from '../common'

export default function TradeWizardStep3Preview({ preview, onBack, onApply, applying = false }) {
  return (
    <Card data-testid="trade-preview-panel" style={{ borderRadius: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 4 }}>
        STEP 3 預覽差異
      </div>
      <div style={{ color: C.textMute, fontSize: 12, marginBottom: 12 }}>
        套用後 holdings 會變成以下差異。這裡只寫入已成交紀錄，不產生買賣建議。
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {preview?.changes?.length ? (
          preview.changes.map((change) => (
            <div
              key={change.code}
              data-testid="trade-wizard-diff-row"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: 10,
                padding: '10px 12px',
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                background: C.subtle,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ color: C.text, fontSize: 13, fontWeight: 800 }}>{change.name}</div>
                <div className="tn" style={{ color: C.textMute, fontSize: 11, marginTop: 2 }}>
                  {change.code}
                </div>
              </div>
              <div style={{ textAlign: 'right', color: C.textSec, fontSize: 12, lineHeight: 1.6 }}>
                <div>
                  股數 {change.beforeQty.toLocaleString()} → {change.afterQty.toLocaleString()}
                </div>
                <div>
                  市值 {change.beforeValue.toLocaleString()} → {change.afterValue.toLocaleString()}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div
            style={{
              padding: 14,
              borderRadius: 8,
              background: alpha(C.textMute, '10'),
              color: C.textMute,
              fontSize: 13,
            }}
          >
            沒有持倉差異，請返回檢查交易內容。
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Button onClick={onBack} disabled={applying}>
          返回確認
        </Button>
        <Button
          data-testid="trade-confirm-btn"
          data-applying={applying ? 'true' : 'false'}
          onClick={onApply}
          disabled={applying || !preview?.trades?.length}
          variant="filled"
          style={{ flex: 1 }}
        >
          {applying ? '套用中...' : '確認套用'}
        </Button>
      </div>
    </Card>
  )
}
