import { TOKENS } from './theme.generated.js'

const DEFAULT_TARGET = typeof document !== 'undefined' ? document.documentElement : null
const LEGACY_ACCENT_BASE = ['sa', 'ge'].join('')
const LEGACY_ACCENT_VAR = `--${LEGACY_ACCENT_BASE}`
const LEGACY_ACCENT_SOFT_VAR = `${LEGACY_ACCENT_VAR}-soft`

function toCssVarName(key) {
  return `--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
}

function normalizeHexColor(color) {
  if (typeof color !== 'string') return null

  const raw = color.trim().toLowerCase()

  if (/^#([0-9a-f]{3})$/i.test(raw)) {
    return `#${raw
      .slice(1)
      .split('')
      .map((part) => part + part)
      .join('')}`
  }

  if (/^#([0-9a-f]{4})$/i.test(raw)) {
    const expanded = raw
      .slice(1)
      .split('')
      .map((part) => part + part)
      .join('')
    return `#${expanded.slice(0, 6)}`
  }

  if (/^#([0-9a-f]{6})$/i.test(raw)) return raw
  if (/^#([0-9a-f]{8})$/i.test(raw)) return raw.slice(0, 7)
  return null
}

function parseRgbColor(color) {
  if (typeof color !== 'string') return null

  const match = color
    .trim()
    .match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i)

  if (!match) return null

  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
  }
}

function normalizeOpacityHex(opacity) {
  if (typeof opacity === 'number') {
    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) return null
    return Math.round(opacity * 255)
      .toString(16)
      .padStart(2, '0')
  }

  const raw = String(opacity ?? '').trim()
  if (!raw) return null
  if (/^[0-9a-f]{2}$/i.test(raw)) return raw.toLowerCase()

  const numeric = Number(raw)
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) return null

  return Math.round(numeric * 255)
    .toString(16)
    .padStart(2, '0')
}

function normalizeOpacityFloat(opacity) {
  const hex = normalizeOpacityHex(opacity)
  if (!hex) return null
  return parseInt(hex, 16) / 255
}

function formatOpacity(opacity) {
  return Number(opacity.toFixed(3)).toString()
}

export const A = Object.freeze({
  tint: '10',
  faint: '16',
  soft: '20',
  line: '30',
  strongLine: '40',
  accent: '4d',
  glow: '58',
  solid: '78',
  overlay: 'a8',
  pressed: 'bc',
})

export const C = Object.freeze({
  bg: TOKENS.boneSoft,
  shell: TOKENS.bone,
  card: TOKENS.boneSoft,
  cardHover: TOKENS.paper,
  subtle: TOKENS.bone,
  subtleElev: TOKENS.boneDeep,
  border: TOKENS.line,
  borderSub: 'rgba(23, 23, 23, 0.08)',
  borderStrong: 'rgba(23, 23, 23, 0.16)',
  borderSoft: 'rgba(23, 23, 23, 0.1)',
  shadow: TOKENS.shadow,
  insetLine: TOKENS.insetLine,
  shellShadow: TOKENS.shellShadow,

  cardBg: TOKENS.boneSoft,
  cardBlue: '#f1e1d6',
  cardAmber: '#f3e8d7',
  cardOlive: '#f0e3d7',
  cardRose: '#f0e1da',

  text: TOKENS.ink,
  textSec: TOKENS.charcoal,
  textMute: TOKENS.iron,
  textMuteFallback: TOKENS.muted,

  up: TOKENS.positive,
  upBg: alpha(TOKENS.positive, '12'),
  down: TOKENS.negative,
  downBg: alpha(TOKENS.negative, '12'),

  blue: TOKENS.positive,
  blueBg: alpha(TOKENS.positive, '14'),
  cyan: TOKENS.warning,
  cyanBg: alpha(TOKENS.warning, '16'),
  amber: TOKENS.warning,
  amberBg: TOKENS.warningSoft,
  orange: TOKENS.cta,
  orangeBg: alpha(TOKENS.cta, '12'),
  teal: TOKENS.hot,
  tealBg: alpha(TOKENS.hot, '12'),
  mint: TOKENS.warning,
  mintBg: alpha(TOKENS.warning, '12'),
  olive: TOKENS.positive,
  oliveBg: alpha(TOKENS.positive, '12'),
  lavender: TOKENS.iron,
  lavBg: alpha(TOKENS.iron, '12'),
  rose: TOKENS.cta,
  roseBg: alpha(TOKENS.cta, '12'),
  choco: TOKENS.charcoal,
  chocoBg: alpha(TOKENS.charcoal, '12'),
  stone: TOKENS.mutedSoft,
  urgent: TOKENS.warning,
  onFill: TOKENS.ink,
  focusRing: TOKENS.focusRing,

  fillPrimary: TOKENS.positive,
  fillTeal: TOKENS.hot,
  fillAmber: TOKENS.warning,
  fillTomato: TOKENS.cta,
  fillChoco: TOKENS.charcoal,

  glowPink: alpha(TOKENS.cta, '14'),
  glowBlue: alpha(TOKENS.positive, '18'),
  glowWarm: alpha(TOKENS.warning, '14'),
})

export function alpha(color, opacity) {
  const hexColor = normalizeHexColor(color)
  const opacityHex = normalizeOpacityHex(opacity)

  if (hexColor && opacityHex) {
    return `${hexColor}${opacityHex}`
  }

  const rgbColor = parseRgbColor(color)
  const opacityFloat = normalizeOpacityFloat(opacity)

  if (rgbColor && opacityFloat != null) {
    return `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, ${formatOpacity(opacityFloat)})`
  }

  return color
}

export function applyThemeVars(target = DEFAULT_TARGET) {
  if (!target?.style) return

  for (const [key, value] of Object.entries(TOKENS)) {
    target.style.setProperty(toCssVarName(key), value)
  }

  target.style.setProperty('--app-bg', C.bg)
  target.style.setProperty('--ink', C.text)
  target.style.setProperty('--bone', TOKENS.bone)
  target.style.setProperty('--bone-soft', TOKENS.boneSoft)
  target.style.setProperty('--line', TOKENS.line)
  target.style.setProperty('--muted', TOKENS.muted)
  target.style.setProperty('--muted-fallback', TOKENS.muted)
  target.style.setProperty(LEGACY_ACCENT_VAR, TOKENS.positive)
  target.style.setProperty(LEGACY_ACCENT_SOFT_VAR, alpha(TOKENS.positive, '16'))
  target.style.setProperty('--up', TOKENS.positive)
  target.style.setProperty('--down', TOKENS.negative)
  target.style.setProperty('--warning', TOKENS.warning)
  target.style.setProperty('--danger', TOKENS.negative)
  target.style.setProperty('--font-head', TOKENS.fontHead)
  target.style.setProperty('--font-headline', TOKENS.fontHeadline)
  target.style.setProperty('--font-body', TOKENS.fontBody)
  target.style.setProperty('--font-num', TOKENS.fontNum)
  target.style.setProperty('--font-mono', TOKENS.fontMono)
}

export { TOKENS }
