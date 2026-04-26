import { useState } from 'react'
import { C, alpha } from '../../theme.js'
import { Button, Card } from '../common'

const inputStyle = {
  width: '100%',
  background: C.subtle,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: '9px 10px',
  color: C.text,
  fontSize: 13,
  fontFamily: 'inherit',
}

export default function TradeWizardStep1Upload({
  onParseText,
  onParseFile,
  onManualTrade,
  parsing,
}) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [manual, setManual] = useState({
    code: '',
    name: '',
    action: '買進',
    qty: '',
    price: '',
  })
  const canManual =
    /^\d{4,6}$/.test(String(manual.code || '').trim()) &&
    Number(manual.qty) > 0 &&
    Number(manual.price) > 0

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Card style={{ borderRadius: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 8 }}>
          STEP 1 上傳
        </div>
        <label
          data-testid="trade-wizard-upload-zone"
          style={{
            display: 'grid',
            placeItems: 'center',
            minHeight: 132,
            border: `1px dashed ${C.borderStrong}`,
            borderRadius: C.radii.md,
            background: alpha(C.fillTeal, '08'),
            cursor: 'pointer',
            color: C.textSec,
            fontSize: 13,
            textAlign: 'center',
            padding: 16,
          }}
        >
          <input
            data-testid="trade-wizard-file-input"
            id="fi"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          上傳成交截圖
        </label>
        {file ? (
          <div style={{ color: C.textMute, fontSize: 12, marginTop: 8 }}>
            <span>待處理截圖佇列</span>
            <span>{` · ${file.name}`}</span>
          </div>
        ) : null}
        <Button
          onClick={() => onParseFile?.(file)}
          disabled={parsing || !file}
          style={{ marginTop: 8, width: '100%' }}
        >
          {parsing ? '解析中...' : '解析截圖'}
        </Button>
      </Card>

      <Card data-testid="manual-trade-entry" style={{ borderRadius: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 8 }}>
          貼上成交文字
        </div>
        <textarea
          data-testid="trade-wizard-text-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="例如：買進 2330 台積電 100 股 @ 950"
          style={{
            ...inputStyle,
            minHeight: 92,
            resize: 'vertical',
            lineHeight: 1.6,
          }}
        />
        <Button
          data-testid="trade-wizard-parse-text-btn"
          onClick={() => onParseText?.(text)}
          disabled={parsing || !text.trim()}
          variant="filled"
          style={{ marginTop: 8, width: '100%' }}
        >
          {parsing ? '解析中...' : '解析文字'}
        </Button>
      </Card>

      <Card style={{ borderRadius: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 8 }}>
          手動填單
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input
            data-testid="manual-trade-code-input"
            id="manual-trade-code-input"
            style={inputStyle}
            value={manual.code}
            onChange={(event) => setManual((prev) => ({ ...prev, code: event.target.value }))}
            placeholder="股票代碼"
          />
          <input
            data-testid="manual-trade-name-input"
            style={inputStyle}
            value={manual.name}
            onChange={(event) => setManual((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="名稱（選填）"
          />
          <select
            data-testid="manual-trade-action-select"
            style={inputStyle}
            value={manual.action}
            onChange={(event) => setManual((prev) => ({ ...prev, action: event.target.value }))}
          >
            <option value="買進">買進</option>
            <option value="賣出">賣出</option>
          </select>
          <input
            data-testid="manual-trade-qty-input"
            id="manual-trade-qty-input"
            style={inputStyle}
            value={manual.qty}
            type="number"
            onChange={(event) => setManual((prev) => ({ ...prev, qty: event.target.value }))}
            placeholder="股數"
          />
          <input
            data-testid="manual-trade-price-input"
            id="manual-trade-price-input"
            style={inputStyle}
            value={manual.price}
            type="number"
            step="0.01"
            onChange={(event) => setManual((prev) => ({ ...prev, price: event.target.value }))}
            placeholder="價格"
          />
          <Button
            data-testid="manual-trade-submit-btn"
            onClick={() => onManualTrade?.(manual)}
            disabled={!canManual}
            variant="filled"
          >
            新增
          </Button>
        </div>
      </Card>
    </div>
  )
}
