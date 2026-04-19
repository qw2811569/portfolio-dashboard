import { createElement as h } from 'react'
import { C, alpha } from '../../theme.js'

export function Card({ children, style = {}, highlighted = false, color = null, ...props }) {
  const accent = color || C.blue
  const baseStyle = {
    background: `linear-gradient(180deg, ${alpha(C.card, 'f4')}, ${alpha(C.subtle, 'fc')})`,
    border: `1px solid ${C.border}`,
    borderRadius: 22,
    padding: '16px 18px',
    boxShadow: `${C.insetLine}, ${C.shadow}`,
    ...(highlighted
      ? {
          borderLeft: `3px solid ${accent}`,
          boxShadow: `${C.insetLine}, ${C.shadow}, 0 0 0 1px ${alpha(accent, '14')}`,
        }
      : {}),
    ...style,
  }

  return h('div', { style: baseStyle, ...props }, children)
}

export function MetricCard({ label, value, tone = 'default', style = {} }) {
  const toneColors = {
    default: C.text,
    up: C.text,
    down: C.down,
    muted: C.textSec,
    teal: C.text,
    amber: C.text,
  }

  return h(
    'div',
    {
      style: {
        background: C.shell,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: '10px 12px',
        boxShadow: `${C.insetLine}, ${C.shadow}`,
        ...style,
      },
    },
    label &&
      h(
        'div',
        {
          style: {
            fontSize: 10,
            color: C.textMute,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontWeight: 500,
            marginBottom: 4,
          },
        },
        label
      ),
    h(
      'div',
      {
        style: {
          fontSize: 15,
          fontWeight: 600,
          color: toneColors[tone] || toneColors.default,
          fontFamily: 'var(--font-num)',
        },
      },
      value
    )
  )
}

export function Badge({ children, color = 'default', size = 'sm', style = {} }) {
  const colors = {
    default: { bg: C.card, text: C.textSec, border: C.border, dot: null },
    up: { bg: C.upBg, text: C.textSec, border: alpha(C.up, '20'), dot: C.up },
    down: { bg: C.downBg, text: C.down, border: alpha(C.down, '20') },
    teal: { bg: alpha(C.teal, '15'), text: C.textSec, border: alpha(C.teal, '25'), dot: C.teal },
    amber: { bg: C.amberBg, text: C.textSec, border: alpha(C.amber, '25'), dot: C.amber },
    olive: { bg: C.oliveBg, text: C.textSec, border: alpha(C.olive, '25'), dot: C.olive },
    lavender: {
      bg: C.lavBg,
      text: C.textSec,
      border: alpha(C.lavender, '25'),
      dot: C.lavender,
    },
  }

  const sizes = {
    xs: { padding: '3px 7px', fontSize: 9 },
    sm: { padding: '5px 9px', fontSize: 10 },
    md: { padding: '6px 11px', fontSize: 11 },
  }

  const selectedColor = colors[color] || colors.default
  const selectedSize = sizes[size] || sizes.sm

  return h(
    'span',
    {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: selectedColor.bg,
        color: selectedColor.text,
        border: `1px solid ${selectedColor.border}`,
        borderRadius: 999,
        fontWeight: 500,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        ...selectedSize,
        ...style,
      },
    },
    selectedColor.dot &&
      h('span', {
        'aria-hidden': 'true',
        style: {
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: selectedColor.dot,
          flexShrink: 0,
        },
      }),
    children
  )
}

export function Button({
  children,
  variant = 'ghost',
  color = 'default',
  size = 'sm',
  disabled = false,
  onClick,
  className = '',
  style = {},
  ...props
}) {
  const A = { strongLine: '2a' }

  const variants = {
    ghost: {
      default: { bg: C.card, text: C.textSec, border: C.border },
      blue: { bg: C.cardBlue, text: C.textSec, border: alpha(C.blue, A.strongLine) },
      rose: { bg: C.cardRose, text: C.down, border: alpha(C.down, A.strongLine) },
      amber: { bg: C.cardAmber, text: C.textSec, border: alpha(C.amber, A.strongLine) },
      olive: { bg: C.oliveBg, text: C.textSec, border: alpha(C.olive, A.strongLine) },
      up: { bg: C.upBg, text: C.textSec, border: alpha(C.up, A.strongLine) },
    },
    filled: {
      default: { bg: C.subtleElev, text: C.text, border: C.border },
      blue: { bg: C.blue, text: C.text, border: alpha(C.blue, A.strongLine) },
    },
  }

  const sizes = {
    xs: { padding: '4px 9px', fontSize: 9 },
    sm: { padding: '6px 12px', fontSize: 10 },
    md: { padding: '8px 15px', fontSize: 11 },
    lg: { padding: '10px 18px', fontSize: 12 },
  }

  const selectedVariant = variants[variant]?.[color] || variants.ghost.default
  const selectedSize = sizes[size] || sizes.sm

  return h(
    'button',
    {
      className: ['ui-btn', className].filter(Boolean).join(' '),
      disabled,
      onClick,
      style: {
        borderRadius: 999,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
        background: selectedVariant.bg,
        color: selectedVariant.text,
        border: `1px solid ${selectedVariant.border}`,
        boxShadow: disabled ? 'none' : C.shadow,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        ...selectedSize,
        ...style,
      },
      ...props,
    },
    children
  )
}

export function SectionHeader({ title, description, action, style = {} }) {
  const lblStyle = {
    fontSize: 10,
    color: C.textMute,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontWeight: 500,
    marginBottom: 5,
  }

  return h(
    'div',
    {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 10,
        flexWrap: 'wrap',
        ...style,
      },
    },
    h(
      'div',
      null,
      title && h('div', { style: { ...lblStyle, color: C.textMute, marginBottom: 4 } }, title),
      description &&
        h(
          'div',
          {
            style: {
              fontSize: 22,
              color: C.text,
              lineHeight: 1.15,
              fontFamily: 'var(--font-headline)',
              fontWeight: 600,
            },
          },
          description
        )
    ),
    action
  )
}

export function EmptyState({ icon = '∅', title, description, action, style = {} }) {
  return h(
    'div',
    {
      style: {
        textAlign: 'center',
        padding: '36px 18px',
        color: C.textMute,
        background: `linear-gradient(180deg, ${alpha(C.subtle, 'fc')}, ${alpha(C.card, 'f2')})`,
        border: `1px dashed ${C.border}`,
        borderRadius: 22,
        ...style,
      },
    },
    h('div', { style: { fontSize: 28, marginBottom: 8, opacity: 0.6 } }, icon),
    title &&
      h(
        'div',
        {
          style: {
            fontSize: 20,
            fontWeight: 600,
            color: C.text,
            marginBottom: 6,
            fontFamily: 'var(--font-headline)',
          },
        },
        title
      ),
    description && h('div', { style: { fontSize: 11, lineHeight: 1.7 } }, description),
    action && h('div', { style: { marginTop: 12 } }, action)
  )
}
