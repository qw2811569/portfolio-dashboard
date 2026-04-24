import { createElement as h } from 'react'
import { C, alpha } from '../../theme.js'
import { normalizeToneKey } from '../../lib/toneResolver.js'

function extractTextContent(content) {
  if (content == null || typeof content === 'boolean') return ''
  if (typeof content === 'string' || typeof content === 'number') return String(content)
  if (Array.isArray(content)) return content.map(extractTextContent).join('')
  if (content?.props?.children) return extractTextContent(content.props.children)
  return ''
}

function getLocalizedMetaStyle(content, { latinTracking = '0.08em', uppercase = false } = {}) {
  const text = extractTextContent(content)
  const hasCjk = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/u.test(text)

  return {
    letterSpacing: hasCjk ? '0' : latinTracking,
    textTransform: hasCjk ? 'none' : uppercase ? 'uppercase' : 'none',
    lineHeight: hasCjk ? 1.4 : 1.25,
    fontVariantNumeric: 'tabular-nums',
  }
}

export function Card({ children, style = {}, highlighted = false, color = null, ...props }) {
  const accent = color || C.ink
  const baseStyle = {
    background: `linear-gradient(180deg, ${alpha(C.card, 'f4')}, ${alpha(C.subtle, 'fc')})`,
    border: `1px solid ${C.border}`,
    borderRadius: 22,
    padding: '16px 16px',
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
    neutral: C.text,
    info: C.text,
    warning: C.text,
    alert: C.text,
    mute: C.textSec,
    up: C.text,
    down: C.down,
    muted: C.textSec,
    teal: C.text,
    positive: C.text,
    amber: C.text,
    iron: C.textSec,
  }
  const resolvedTone = toneColors[tone] ? tone : normalizeToneKey(tone, 'neutral')

  return h(
    'div',
    {
      style: {
        background: C.shell,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: '8px 12px',
        boxShadow: `${C.insetLine}, ${C.shadow}`,
        ...style,
      },
    },
    label &&
      h(
        'div',
        {
          style: {
            fontSize: 12,
            color: C.textMute,
            fontWeight: 500,
            marginBottom: 4,
            ...getLocalizedMetaStyle(label, { latinTracking: '0.12em', uppercase: true }),
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
          color: toneColors[tone] || toneColors[resolvedTone] || toneColors.default,
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
    neutral: { bg: C.card, text: C.textSec, border: C.border, dot: null },
    info: {
      bg: alpha(C.cta, '12'),
      text: C.textSec,
      border: alpha(C.cta, '25'),
      dot: C.cta,
    },
    warning: { bg: C.amberBg, text: C.textSec, border: alpha(C.amber, '25'), dot: C.amber },
    alert: {
      bg: alpha(C.cta, '12'),
      text: C.textSec,
      border: alpha(C.cta, '25'),
      dot: C.cta,
    },
    mute: { bg: alpha(C.iron, '12'), text: C.textSec, border: alpha(C.iron, '25'), dot: C.iron },
    up: { bg: C.upBg, text: C.textSec, border: alpha(C.up, '20'), dot: C.up },
    down: { bg: C.downBg, text: C.down, border: alpha(C.down, '20') },
    teal: {
      bg: alpha(C.positive, '15'),
      text: C.textSec,
      border: alpha(C.positive, '25'),
      dot: C.positive,
    },
    positive: {
      bg: alpha(C.positive, '15'),
      text: C.textSec,
      border: alpha(C.positive, '25'),
      dot: C.positive,
    },
    amber: { bg: C.amberBg, text: C.textSec, border: alpha(C.amber, '25'), dot: C.amber },
    olive: { bg: alpha(C.iron, '12'), text: C.textSec, border: alpha(C.iron, '25'), dot: C.iron },
    iron: { bg: alpha(C.iron, '12'), text: C.textSec, border: alpha(C.iron, '25'), dot: C.iron },
    lavender: {
      bg: C.lavBg,
      text: C.textSec,
      border: alpha(C.lavender, '25'),
      dot: C.lavender,
    },
  }

  const sizes = {
    xs: { padding: '4px 8px', fontSize: 11 },
    sm: { padding: '4px 8px', fontSize: 12 },
    md: { padding: '4px 8px', fontSize: 11 },
  }

  const resolvedColor = colors[color] ? color : normalizeToneKey(color, 'neutral')
  const selectedColor = colors[color] || colors[resolvedColor] || colors.default
  const selectedSize = sizes[size] || sizes.sm
  const localizedStyle = getLocalizedMetaStyle(children, { uppercase: true })

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
        ...selectedSize,
        ...localizedStyle,
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
      blue: { bg: alpha(C.cta, '12'), text: C.textSec, border: alpha(C.cta, A.strongLine) },
      positive: {
        bg: alpha(C.positive, '12'),
        text: C.textSec,
        border: alpha(C.positive, A.strongLine),
      },
      rose: { bg: C.cardRose, text: C.down, border: alpha(C.down, A.strongLine) },
      amber: { bg: C.cardAmber, text: C.textSec, border: alpha(C.amber, A.strongLine) },
      olive: { bg: alpha(C.iron, '12'), text: C.textSec, border: alpha(C.iron, A.strongLine) },
      iron: { bg: alpha(C.iron, '12'), text: C.textSec, border: alpha(C.iron, A.strongLine) },
      up: { bg: C.upBg, text: C.textSec, border: alpha(C.up, A.strongLine) },
    },
    filled: {
      default: { bg: C.subtleElev, text: C.text, border: C.border },
      blue: { bg: C.cta, text: C.onFill, border: alpha(C.cta, A.strongLine) },
    },
  }

  const sizes = {
    xs: { padding: '8px 8px', fontSize: 11 },
    sm: { padding: '8px 12px', fontSize: 12 },
    md: { padding: '8px 16px', fontSize: 11 },
    lg: { padding: '12px 16px', fontSize: 12 },
  }

  const selectedVariant = variants[variant]?.[color] || variants.ghost.default
  const selectedSize = sizes[size] || sizes.sm
  const localizedStyle = getLocalizedMetaStyle(children, { uppercase: true })

  return h(
    'button',
    {
      className: ['ui-btn', className].filter(Boolean).join(' '),
      disabled,
      onClick,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 44,
        minHeight: 44,
        borderRadius: 999,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
        transition: 'background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
        background: selectedVariant.bg,
        color: selectedVariant.text,
        border: `1px solid ${selectedVariant.border}`,
        boxShadow: disabled ? 'none' : C.shadow,
        ...selectedSize,
        ...localizedStyle,
        ...style,
      },
      ...props,
    },
    children
  )
}

export function SectionHeader({ title, description, action, style = {} }) {
  const lblStyle = {
    fontSize: 12,
    color: C.textMute,
    fontWeight: 500,
    marginBottom: 4,
    ...getLocalizedMetaStyle(title, { latinTracking: '0.12em', uppercase: true }),
  }

  return h(
    'div',
    {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 8,
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
        padding: '32px 16px',
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
            marginBottom: 4,
            fontFamily: 'var(--font-headline)',
          },
        },
        title
      ),
    description && h('div', { style: { fontSize: 11, lineHeight: 1.7 } }, description),
    action && h('div', { style: { marginTop: 12 } }, action)
  )
}
