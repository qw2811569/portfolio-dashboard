import { C } from '../theme.js'

export const LEGACY_TONE_MAP = Object.freeze({
  default: 'neutral',
  muted: 'mute',
  iron: 'mute',
  lavender: 'mute',
  ink: 'neutral',
  text: 'neutral',
  charcoal: 'neutral',
  blue: 'info',
  cyan: 'info',
  cta: 'info',
  teal: 'positive',
  olive: 'positive',
  up: 'positive',
  amber: 'warning',
  mint: 'warning',
  rose: 'alert',
  hot: 'alert',
  orange: 'alert',
})

export const CANONICAL_TONE_COLORS = Object.freeze({
  neutral: C.ink,
  info: C.cta,
  positive: C.positive,
  warning: C.warning,
  alert: C.cta,
  mute: C.iron,
})

export const CANONICAL_TONE_KEYS = Object.freeze(Object.keys(CANONICAL_TONE_COLORS))

function normalizeToneInput(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function normalizeToneKey(raw, fallback = 'neutral') {
  const normalizedRaw = normalizeToneInput(raw)
  const normalizedFallback = normalizeToneInput(fallback)

  if (normalizedRaw && CANONICAL_TONE_COLORS[normalizedRaw]) return normalizedRaw
  if (normalizedRaw && LEGACY_TONE_MAP[normalizedRaw]) return LEGACY_TONE_MAP[normalizedRaw]

  return CANONICAL_TONE_COLORS[normalizedFallback] ? normalizedFallback : 'neutral'
}

export function resolveTone(raw, fallback = 'neutral') {
  return CANONICAL_TONE_COLORS[normalizeToneKey(raw, fallback)]
}
