export const C = {
  bg: '#F4EFE6',
  shell: '#EEE7DB',
  card: '#F4EFE6',
  cardHover: '#F7F2EA',
  subtle: '#EEE7DB',
  subtleElev: '#E8E1D3',
  border: '#CFC6B8',
  borderSub: 'rgba(111,116,107,0.14)',
  borderStrong: 'rgba(111,116,107,0.26)',
  borderSoft: 'rgba(111,116,107,0.1)',
  shadow: '0 1px 0 rgba(32,40,35,0.06)',
  insetLine: 'inset 0 1px 0 rgba(255,255,255,0.5)',
  shellShadow: '0 18px 34px rgba(91,84,72,0.08)',

  cardBlue: '#E1E6DA',
  cardAmber: '#F3E8D7',
  cardOlive: '#E1E6DA',
  cardRose: '#F0E1DA',

  text: '#202823',
  textSec: '#3B433D',
  textMute: '#5A5F57',
  textMuteFallback: '#6F746B',

  up: '#6F8568',
  upBg: 'rgba(111,133,104,0.12)',
  down: '#B65A4D',
  downBg: 'rgba(182,90,77,0.12)',

  blue: '#A8B59A',
  blueBg: 'rgba(168,181,154,0.14)',
  cyan: '#C4CEB5',
  cyanBg: 'rgba(196,206,181,0.16)',
  amber: '#B9853E',
  amberBg: 'rgba(185,133,62,0.12)',
  orange: '#B65A4D',
  orangeBg: 'rgba(182,90,77,0.12)',
  teal: '#7E9175',
  tealBg: 'rgba(126,145,117,0.12)',
  mint: '#A8B59A',
  mintBg: 'rgba(168,181,154,0.12)',
  olive: '#6F8568',
  oliveBg: 'rgba(111,133,104,0.12)',
  lavender: '#8A9580',
  lavBg: 'rgba(138,149,128,0.12)',
  rose: '#B77F72',
  roseBg: 'rgba(183,127,114,0.12)',
  choco: '#8B725D',
  chocoBg: 'rgba(139,114,93,0.12)',
  stone: '#8A837A',
  urgent: '#B9853E',
  onFill: '#202823',
  focusRing: '0 0 0 3px rgba(168,181,154,0.22)',

  fillPrimary: '#A8B59A',
  fillTeal: '#7E9175',
  fillAmber: '#B9853E',
  fillTomato: '#B65A4D',
  fillChoco: '#8B725D',

  glowPink: 'rgba(183,127,114,0.08)',
  glowBlue: 'rgba(168,181,154,0.1)',
  glowWarm: 'rgba(185,133,62,0.08)',
}

export const A = {
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
}

export const alpha = (color, opacity) => `${color}${opacity}`

export function applyThemeVars(target = document.documentElement) {
  if (!target?.style) return
  target.style.setProperty('--app-bg', C.bg)
  target.style.setProperty('--ink', C.text)
  target.style.setProperty('--bone', C.shell)
  target.style.setProperty('--bone-soft', C.bg)
  target.style.setProperty('--line', C.border)
  target.style.setProperty('--muted', C.textMute)
  target.style.setProperty('--muted-fallback', C.textMuteFallback)
  target.style.setProperty('--sage', C.blue)
  target.style.setProperty('--sage-soft', C.cyan)
  target.style.setProperty('--up', C.up)
  target.style.setProperty('--down', C.down)
  target.style.setProperty('--warning', C.amber)
  target.style.setProperty('--danger', C.down)
  // 中文先行，英文走 Latin fallback；數字保留 Source Serif 4 對齊節奏。
  target.style.setProperty(
    '--font-body',
    "'Source Han Sans TC','Noto Sans TC','Source Sans 3',sans-serif"
  )
  target.style.setProperty(
    '--font-headline',
    "'Source Han Serif TC','Noto Serif TC','Source Serif 4',serif"
  )
  target.style.setProperty('--font-num', "'Source Serif 4','IBM Plex Mono','tabular-nums',serif")
  target.style.setProperty('--font-mono', "'IBM Plex Mono','SFMono-Regular',ui-monospace,monospace")
}
