export const TRADE_DISCLAIMER_STORAGE_KEY = 'trade-disclaimer-v1-ack-at'
export const TRADE_DISCLAIMER_REPROMPT_DAYS = 90
export const TRADE_DISCLAIMER_REPROMPT_MS = TRADE_DISCLAIMER_REPROMPT_DAYS * 24 * 60 * 60 * 1000
export const TRADE_DISCLAIMER_DOC_HREF =
  '/docs/release/internal-beta-signoff.md#legal-%E5%8B%BE%E9%81%B8'

export const TRADE_DISCLAIMER_POINTS = Object.freeze([
  '本 app 是持倉資料管理工具，不是券商下單終端。',
  'AI 分析只作輔助參考，不構成投資建議；實際決策仍由你自行判斷。',
  '7865 insider compliance 以記錄實際交易為主，不生成買賣建議。',
  '上傳成交或手動記錄前，請先確認資料內容與成交資訊正確。',
])

export const TRADE_DISCLAIMER_LEGAL_SUMMARY =
  '這是內部 beta 的交易提醒，不是投資建議；owner 仍需自行判斷並自行負責。'

function toDateValue(value) {
  if (value instanceof Date) return value
  const parsed = new Date(value || '')
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getDefaultStorage(storage) {
  if (storage) return storage
  if (typeof globalThis === 'undefined') return null
  return globalThis.localStorage || null
}

export function normalizeTradeDisclaimerAckAt(value) {
  const parsed = toDateValue(value)
  return parsed ? parsed.toISOString() : ''
}

export function readTradeDisclaimerAckAt(storage) {
  try {
    const raw = getDefaultStorage(storage)?.getItem?.(TRADE_DISCLAIMER_STORAGE_KEY)
    return normalizeTradeDisclaimerAckAt(raw)
  } catch {
    return ''
  }
}

export function writeTradeDisclaimerAckAt(storage, now = new Date()) {
  const targetStorage = getDefaultStorage(storage)
  const isoValue = normalizeTradeDisclaimerAckAt(now) || new Date().toISOString()
  try {
    targetStorage?.setItem?.(TRADE_DISCLAIMER_STORAGE_KEY, isoValue)
  } catch {
    /* localStorage can fail in private mode or embedded browsers */
  }
  return isoValue
}

export function shouldPromptTradeDisclaimer(ackAt, { now = new Date() } = {}) {
  const acknowledgedAt = toDateValue(ackAt)
  const nowDate = toDateValue(now) || new Date()
  if (!acknowledgedAt) return true
  return nowDate.getTime() - acknowledgedAt.getTime() >= TRADE_DISCLAIMER_REPROMPT_MS
}
