export const C = {
  bg: '#F6EDE1',
  shell: '#F2E4D6',
  card: '#FBF4EA',
  cardHover: '#FFF8F1',
  subtle: '#F1E5D8',
  subtleElev: '#E9DCCD',
  border: 'rgba(59,44,39,0.12)',
  borderSub: 'rgba(59,44,39,0.08)',
  borderStrong: 'rgba(59,44,39,0.18)',
  borderSoft: 'rgba(59,44,39,0.10)',
  shadow: '0 14px 34px rgba(41,28,24,0.10)',
  insetLine: 'inset 0 1px 0 rgba(255,255,255,0.65)',
  shellShadow: '0 20px 44px rgba(67,35,28,0.12)',

  cardBlue: '#EEF0FF',
  cardAmber: '#F6E3D0',
  cardOlive: '#E3EBDF',
  cardRose: '#F5E0E4',

  text: '#2C1E1A',
  textSec: '#604E46',
  textMute: '#8A776D',

  up: '#B55A4C',
  upBg: '#B55A4C18',
  down: '#5A7F83',
  downBg: '#5A7F831A',

  blue: '#3271D8',
  blueBg: '#3271D814',
  cyan: '#3A95C9',
  cyanBg: '#3A95C914',
  amber: '#B06E43',
  amberBg: '#B06E4316',
  orange: '#C27652',
  orangeBg: '#C2765214',
  teal: '#6E8269',
  tealBg: '#6E826914',
  mint: '#7A8E75',
  mintBg: '#7A8E7514',
  olive: '#718560',
  oliveBg: '#71856014',
  lavender: '#9A6488',
  lavBg: '#9A648814',
  rose: '#B86A72',
  roseBg: '#B86A7214',
  choco: '#855A45',
  chocoBg: '#855A4514',
  stone: '#9A897E',
  urgent: '#B9365D',
  onFill: '#FFF6F0',
  focusRing: '0 0 0 3px rgba(185,54,93,0.14)',
  accent: '#B9365D',
  info: '#3271D8',
  fillPrimary: '#EADACC',

  neonPink: '#D63A7C',
  neonBlue: '#2D8CFF',
  neonGlow: 'rgba(214,58,124,0.24)',
  sunsetStart: '#6D5BFF',
  sunsetMid: '#D63A7C',
  sunsetEnd: '#F29D52',
  grain: 'rgba(92,67,58,0.04)',

  fillTeal: '#708A68',
  fillTomato: '#BC6A57',
  fillChoco: '#7F4C39',
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
  target.style.setProperty('--app-grain', C.grain)
}
