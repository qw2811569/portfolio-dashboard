export const SKIPPED_TARGET_PRICE_INSTRUMENT_TYPES = new Set(['權證', 'ETF', '指數', '債券'])

export function normalizeInstrumentType(type) {
  return String(type || '').trim()
}

export function getInstrumentTypeLabel(value) {
  if (!value || typeof value !== 'object') return normalizeInstrumentType(value)

  return normalizeInstrumentType(value.type || value.position?.type || value.holding?.type)
}

export function isSkippedTargetPriceInstrumentType(value) {
  return SKIPPED_TARGET_PRICE_INSTRUMENT_TYPES.has(getInstrumentTypeLabel(value))
}
