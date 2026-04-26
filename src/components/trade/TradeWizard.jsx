import { useMemo, useState } from 'react'
import { C, alpha } from '../../theme.js'
import {
  buildManualTrade,
  parseTradeScreenshot,
  parseTradesFromText,
} from '../../lib/tradeParser.js'
import { persistTradeApply, previewTradeApply } from '../../lib/tradeApply.js'
import { Card } from '../common'
import TradeWizardStep1Upload from './TradeWizardStep1Upload.jsx'
import TradeWizardStep2Parse from './TradeWizardStep2Parse.jsx'
import TradeWizardStep3Preview from './TradeWizardStep3Preview.jsx'
import TradeWizardStep4Apply from './TradeWizardStep4Apply.jsx'
import { TRADE_BLOCK_REASON_HUMAN, TRADE_BLOCK_REASON_UNCONFIRMED } from './tradeMessages.js'

const steps = ['上傳', '解析', '預覽', '套用']

export default function TradeWizard({
  portfolioId = 'me',
  holdings = [],
  tradeLog = [],
  setHoldings = () => {},
  setTradeLog = () => {},
  marketQuotes = null,
  toSlashDate = () => new Date().toISOString().slice(0, 10),
  flashSaved = () => {},
  disclaimerAckedAt = '',
}) {
  const [step, setStep] = useState(1)
  const [trades, setTrades] = useState([])
  const [tradeDate, setTradeDate] = useState(() => toSlashDate())
  const [parsing, setParsing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [applyResult, setApplyResult] = useState(null)

  const preview = useMemo(
    () => previewTradeApply({ holdings, trades, marketQuotes }),
    [holdings, marketQuotes, trades]
  )
  const hasUnconfirmedActions = useMemo(
    () => trades.some((trade) => trade?.needsActionConfirmation),
    [trades]
  )
  const actionBlockReason = hasUnconfirmedActions ? TRADE_BLOCK_REASON_UNCONFIRMED : ''

  const acceptParsed = (parsed) => {
    const nextTrades = Array.isArray(parsed?.trades) ? parsed.trades : []
    if (!nextTrades.length) {
      setError('沒有解析到有效交易，請改用手動填單。')
      return
    }
    setTradeDate(parsed.tradeDate || toSlashDate())
    setTrades(nextTrades)
    setError('')
    setStep(2)
  }

  const handleParseText = (text) => {
    acceptParsed(parseTradesFromText(text, { fallbackDate: toSlashDate() }))
  }

  const handleParseFile = async (file) => {
    if (!file) return
    setParsing(true)
    setError('')
    try {
      acceptParsed(await parseTradeScreenshot(file, { fallbackDate: toSlashDate() }))
    } catch (err) {
      setError(err?.message || '截圖解析失敗，請改用文字或手動填單。')
    } finally {
      setParsing(false)
    }
  }

  const handleManualTrade = (manual) => {
    acceptParsed(buildManualTrade({ ...manual, tradeDate: toSlashDate() }))
  }

  const updateTrade = (index, patch) => {
    setTrades((current) =>
      current.map((trade, tradeIndex) => (tradeIndex === index ? { ...trade, ...patch } : trade))
    )
  }

  const goToPreview = () => {
    if (hasUnconfirmedActions) {
      setError(`${TRADE_BLOCK_REASON_HUMAN}。`)
      return
    }
    setError('')
    setStep(3)
  }

  const applyTrades = async () => {
    if (applying) return
    if (hasUnconfirmedActions) {
      setError(`${TRADE_BLOCK_REASON_HUMAN}。`)
      return
    }
    setApplying(true)
    setError('')
    try {
      const result = await persistTradeApply({
        portfolioId,
        holdings,
        tradeLog,
        setHoldings,
        setTradeLog,
        trades,
        tradeDate,
        marketQuotes,
        disclaimerAckedAt,
      })
      setApplyResult(result)
      setStep(4)
      flashSaved?.(`已寫入 ${result.entries.length} 筆成交`, 3000)
    } catch (err) {
      setError(err?.message || '交易寫入失敗，請稍後再試。')
    } finally {
      setApplying(false)
    }
  }

  const reset = () => {
    setStep(1)
    setTrades([])
    setTradeDate(toSlashDate())
    setError('')
    setApplyResult(null)
  }

  return (
    <div data-testid="trade-wizard" style={{ display: 'grid', gap: 14 }}>
      <Card style={{ borderRadius: 8, padding: '12px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {steps.map((label, index) => {
            const active = step === index + 1
            const done = step > index + 1
            return (
              <div
                key={label}
                style={{
                  display: 'grid',
                  gap: 5,
                  color: active ? C.text : done ? C.textSec : C.textMute,
                  fontSize: 12,
                  fontWeight: active ? 800 : 600,
                }}
              >
                <div>{`STEP ${index + 1}`}</div>
                <div
                  style={{
                    height: 5,
                    borderRadius: 999,
                    background: active || done ? C.up : alpha(C.textMute, '18'),
                  }}
                />
                <div>{label}</div>
              </div>
            )
          })}
        </div>
      </Card>

      {error ? (
        <div
          data-testid="trade-wizard-error"
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: `1px solid ${alpha(C.down, '25')}`,
            color: C.down,
            background: alpha(C.down, '10'),
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <TradeWizardStep1Upload
          parsing={parsing}
          onParseText={handleParseText}
          onParseFile={handleParseFile}
          onManualTrade={handleManualTrade}
        />
      ) : null}
      {step === 2 ? (
        <TradeWizardStep2Parse
          trades={trades}
          onChangeTrade={updateTrade}
          onBack={() => setStep(1)}
          onNext={goToPreview}
          hasUnconfirmedActions={hasUnconfirmedActions}
        />
      ) : null}
      {step === 3 ? (
        <TradeWizardStep3Preview
          preview={preview}
          onBack={() => setStep(2)}
          onApply={applyTrades}
          applying={applying}
          blockReason={actionBlockReason}
        />
      ) : null}
      {step === 4 ? <TradeWizardStep4Apply result={applyResult} onReset={reset} /> : null}
    </div>
  )
}
