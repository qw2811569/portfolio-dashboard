import { TOKENS as GENERATED_TOKENS } from './theme.generated.js'

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

// Keep the app-facing token surface stable while generated tokens stay canonical-only.
function buildRuntimeTokens() {
  return Object.freeze({
    ...GENERATED_TOKENS,
    boneSoft: alpha(GENERATED_TOKENS.bone, 'f2'),
    paper: alpha(GENERATED_TOKENS.bone, 'db'),
    sand: alpha(GENERATED_TOKENS.warning, '18'),
    line: GENERATED_TOKENS.boneDeep,
    lineSoft: alpha(GENERATED_TOKENS.charcoal, '14'),
    muted: GENERATED_TOKENS.iron,
    mutedSoft: alpha(GENERATED_TOKENS.iron, 'b8'),
    warningSoft: alpha(GENERATED_TOKENS.warning, '3d'),
    positiveSoft: alpha(GENERATED_TOKENS.positive, '29'),
    ctaSoft: alpha(GENERATED_TOKENS.cta, '1f'),
    hotSoft: alpha(GENERATED_TOKENS.hot, '1f'),
    negativeSoft: alpha(GENERATED_TOKENS.negative, '1f'),
    shadow: `0 1px 0 ${alpha(GENERATED_TOKENS.charcoal, '0d')}, inset 0 1px 0 ${alpha(GENERATED_TOKENS.bone, 'b8')}`,
    insetLine: `inset 0 1px 0 ${alpha(GENERATED_TOKENS.bone, 'b8')}`,
    shellShadow: `0 18px 34px ${alpha(GENERATED_TOKENS.charcoal, '14')}`,
    focusRing: `0 0 0 3px ${alpha(GENERATED_TOKENS.positive, '38')}`,
    fontHeadline: GENERATED_TOKENS.fontDisplay,
    fontHead: GENERATED_TOKENS.fontTitle,
    fontNum: GENERATED_TOKENS.fontDisplay,
    fontMono: GENERATED_TOKENS.fontCaption,
    radius: '24px',
    radiusSm: '16px',
    ease: '240ms ease',
    max: '1240px',
  })
}

export const TOKENS = buildRuntimeTokens()

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
  ink: TOKENS.ink,
  charcoal: TOKENS.charcoal,
  iron: TOKENS.iron,
  bone: TOKENS.bone,
  boneDeep: TOKENS.boneDeep,
  warning: TOKENS.warning,
  positive: TOKENS.positive,
  cta: TOKENS.cta,
  hot: TOKENS.hot,
  negative: TOKENS.negative,

  bg: TOKENS.boneSoft,
  shell: TOKENS.bone,
  card: TOKENS.boneSoft,
  cardHover: TOKENS.paper,
  subtle: TOKENS.bone,
  subtleElev: TOKENS.boneDeep,
  border: TOKENS.line,
  borderSub: alpha(TOKENS.charcoal, '14'),
  borderStrong: alpha(TOKENS.charcoal, '29'),
  borderSoft: alpha(TOKENS.charcoal, '1a'),
  shadow: TOKENS.shadow,
  insetLine: TOKENS.insetLine,
  shellShadow: TOKENS.shellShadow,

  cardBg: TOKENS.boneSoft,
  // R156 #1 Orange lock down · cardBlue/cardOlive/cardRose/cardAmber 不再各自染色
  // 全部 alias 到 boneSoft + 微 charcoal 邊 · 視覺只剩 米 + 黑灰 + 1 橘（從 C.cta 直接取）
  cardBlue: TOKENS.boneSoft,
  cardAmber: TOKENS.boneSoft,
  cardOlive: TOKENS.boneSoft,
  cardRose: TOKENS.boneSoft,

  text: TOKENS.ink,
  textSec: TOKENS.charcoal,
  textMute: alpha(TOKENS.charcoal, 'bf'),
  textMuteFallback: alpha(TOKENS.charcoal, 'bf'),

  up: TOKENS.positive,
  upBg: alpha(TOKENS.positive, '12'),
  down: TOKENS.negative,
  downBg: alpha(TOKENS.negative, '12'),

  // R156 #1 Orange lock down · 米 + 黑灰 + 1 橘 三軸
  // 所有「彩色 chip / fill / glow」alias 都收回中性（charcoal / iron / boneSoft）
  // 唯一可亮的是 cta 主橘 · 不准被多色稀釋
  cyanBg: alpha(TOKENS.charcoal, '0c'),
  amber: TOKENS.warning,
  amberBg: alpha(TOKENS.charcoal, '0c'),
  orange: TOKENS.cta,
  orangeBg: alpha(TOKENS.cta, '12'),
  mint: TOKENS.charcoal,
  mintBg: alpha(TOKENS.charcoal, '0c'),
  lavender: TOKENS.iron,
  lavBg: alpha(TOKENS.iron, '0c'),
  rose: TOKENS.cta,
  roseBg: alpha(TOKENS.cta, '0c'),
  choco: TOKENS.charcoal,
  chocoBg: alpha(TOKENS.charcoal, '0c'),
  stone: TOKENS.mutedSoft,
  urgent: TOKENS.cta,
  onFill: TOKENS.ink,
  focusRing: TOKENS.focusRing,

  // 黑灰大色塊 token（R156 §5 #2 撐骨架用）
  darkPanel: TOKENS.ink,
  darkPanelSoft: alpha(TOKENS.ink, 'eb'),
  charcoalPanel: TOKENS.charcoal,

  fillTeal: TOKENS.charcoal,
  fillAmber: TOKENS.charcoal,
  fillTomato: TOKENS.cta,
  fillChoco: TOKENS.charcoal,

  glowPink: alpha(TOKENS.cta, '14'),
  glowBlue: alpha(TOKENS.charcoal, '0c'),
  glowWarm: alpha(TOKENS.charcoal, '0c'),
})

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
  target.style.setProperty('--muted', C.textMute)
  target.style.setProperty('--muted-fallback', C.textMuteFallback)
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
