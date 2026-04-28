import { PORTFOLIO_ALIAS_TO_SUFFIX } from '../constants.js'
import { API_ENDPOINTS } from './apiEndpoints.js'
import { applyTradeEntryToHoldings } from './holdings.js'
import { pfKey } from './portfolioUtils.js'
import { buildTradeLogEntries } from './tradeParseUtils.js'

function normalizeTrades(trades = []) {
  return (Array.isArray(trades) ? trades : []).filter(
    (trade) =>
      String(trade?.code || '').trim() &&
      (Number(trade?.qty) || 0) > 0 &&
      (Number(trade?.price) || 0) > 0
  )
}

export function previewTradeApply({ holdings = [], trades = [], marketQuotes = null } = {}) {
  const parsed = { trades: normalizeTrades(trades) }
  const before = Array.isArray(holdings) ? holdings : []
  const after = parsed.trades.reduce(
    (rows, trade) => applyTradeEntryToHoldings(rows, trade, marketQuotes),
    before
  )
  const beforeByCode = new Map(before.map((holding) => [String(holding.code), holding]))
  const afterByCode = new Map(after.map((holding) => [String(holding.code), holding]))
  const codes = Array.from(new Set([...beforeByCode.keys(), ...afterByCode.keys()])).sort()

  return {
    before,
    after,
    trades: parsed.trades,
    changes: codes
      .map((code) => {
        const prev = beforeByCode.get(code) || null
        const next = afterByCode.get(code) || null
        const prevQty = Number(prev?.qty) || 0
        const nextQty = Number(next?.qty) || 0
        const prevValue = Number(prev?.value) || 0
        const nextValue = Number(next?.value) || 0
        if (prevQty === nextQty && Math.round(prevValue) === Math.round(nextValue)) return null
        return {
          code,
          name: next?.name || prev?.name || code,
          beforeQty: prevQty,
          afterQty: nextQty,
          beforeValue: Math.round(prevValue),
          afterValue: Math.round(nextValue),
        }
      })
      .filter(Boolean),
  }
}

export async function persistTradeApply({
  portfolioId = 'me',
  holdings,
  tradeLog,
  setHoldings,
  setTradeLog,
  trades = [],
  tradeDate = new Date().toISOString().slice(0, 10),
  marketQuotes = null,
  now = new Date(),
  disclaimerAckedAt = '',
} = {}) {
  const preview = previewTradeApply({ holdings, trades, marketQuotes })
  const parsed = { trades: preview.trades }
  const entries = buildTradeLogEntries({
    parsed,
    tradeDate,
    memoQuestions: [],
    memoAnswers: [],
    now,
  })
  const beforeTradeLog = Array.isArray(tradeLog) ? tradeLog : []
  const nextTradeLog = [...entries, ...beforeTradeLog]

  setHoldings?.(preview.after)
  setTradeLog?.(nextTradeLog)

  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(
      pfKey(portfolioId, PORTFOLIO_ALIAS_TO_SUFFIX.holdings),
      JSON.stringify(preview.after)
    )
    window.localStorage.setItem(
      pfKey(portfolioId, PORTFOLIO_ALIAS_TO_SUFFIX.tradeLog),
      JSON.stringify(nextTradeLog)
    )
  }

  if (typeof fetch === 'function') {
    await fetch(API_ENDPOINTS.TRADE_AUDIT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portfolioId,
        action: 'trade.confirm',
        disclaimerAckedAt,
        before: {
          holdings: Array.isArray(holdings) ? holdings : [],
          tradeLogCount: beforeTradeLog.length,
        },
        after: {
          holdings: preview.after,
          tradeLogCount: nextTradeLog.length,
          appendedTradeLogEntries: entries,
          targetPriceUpdates: [],
          memoAnswers: [],
        },
      }),
    }).catch(() => null)
  }

  return {
    ...preview,
    entries,
    nextTradeLog,
  }
}
