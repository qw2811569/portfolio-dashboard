export const C = {
  bg: '#171C20',
  shell: '#232A2F',
  card: '#2D363A',
  cardHover: '#364145',
  subtle: '#242D31',
  subtleElev: '#384347',
  border: 'rgba(241,233,216,0.12)',
  borderSub: 'rgba(241,233,216,0.07)',
  borderStrong: 'rgba(241,233,216,0.18)',
  borderSoft: 'rgba(241,233,216,0.09)',
  shadow: '0 18px 38px rgba(6, 10, 14, 0.26)',
  insetLine: 'inset 0 1px 0 rgba(255,255,255,0.03)',
  shellShadow: '0 20px 48px rgba(8, 10, 18, 0.34)',

  cardBlue: '#203B45',
  cardAmber: '#40342C',
  cardOlive: '#2F4037',
  cardRose: '#402E38',

  text: '#F1E9D8',
  textSec: '#D0C4B8',
  textMute: '#AA9F95',

  up: '#C9775F',
  upBg: '#C9775F18',
  down: '#7FB19A',
  downBg: '#7FB19A18',

  blue: '#6FD6FF',
  blueBg: '#6FD6FF14',
  cyan: '#83C7D7',
  cyanBg: '#83C7D714',
  amber: '#D7A35D',
  amberBg: '#D7A35D14',
  orange: '#BF7C63',
  orangeBg: '#BF7C6314',
  teal: '#6ED0D6',
  tealBg: '#6ED0D614',
  mint: '#8CA993',
  mintBg: '#8CA99314',
  olive: '#96B39C',
  oliveBg: '#96B39C16',
  lavender: '#FF5FA2',
  lavBg: '#FF5FA214',
  rose: '#D58A9F',
  roseBg: '#D58A9F14',
  choco: '#9D6C55',
  chocoBg: '#9D6C5514',
  stone: '#978C84',
  urgent: '#D7A35D',
  onFill: '#FFF7EA',
  focusRing: '0 0 0 3px rgba(111,214,255,0.16)',

  fillPrimary: '#FF5FA2',
  fillTeal: '#2888A2',
  fillAmber: '#9A6B28',
  fillTomato: '#9F5A49',
  fillChoco: '#6D493A',

  glowPink: 'rgba(255,95,162,0.18)',
  glowBlue: 'rgba(111,214,255,0.16)',
  glowWarm: 'rgba(215,163,93,0.14)',
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
  target.style.setProperty(
    '--font-body',
    "'Noto Serif TC','Source Han Serif TC','Source Han Serif','Iowan Old Style','Georgia',serif"
  )
  target.style.setProperty(
    '--font-mono',
    "'IBM Plex Mono','JetBrains Mono','SFMono-Regular',ui-monospace,monospace"
  )
}
