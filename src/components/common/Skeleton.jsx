import { createElement as h } from 'react'

function renderCard(index) {
  return h(
    'div',
    {
      key: `skeleton-card-${index}`,
      className: 'skeleton-card-shell',
    },
    h(
      'div',
      { className: 'skeleton-card-head' },
      h('span', { className: 'skeleton skeleton-circle skeleton-card-avatar' }),
      h(
        'div',
        { className: 'skeleton-card-copy' },
        h('span', { className: 'skeleton skeleton-line skeleton-w-36' }),
        h('span', { className: 'skeleton skeleton-line skeleton-w-72' })
      )
    ),
    h('div', { className: 'skeleton skeleton-card-block' }),
    h(
      'div',
      { className: 'skeleton-card-foot' },
      h('span', { className: 'skeleton skeleton-line skeleton-w-28' }),
      h('span', { className: 'skeleton skeleton-line skeleton-w-44' })
    )
  )
}

function renderRow(index) {
  return h(
    'div',
    {
      key: `skeleton-row-${index}`,
      className: 'skeleton-row-shell',
    },
    h('span', { className: 'skeleton skeleton-circle skeleton-row-avatar' }),
    h(
      'div',
      { className: 'skeleton-row-copy' },
      h('span', { className: 'skeleton skeleton-line skeleton-w-32' }),
      h('span', { className: 'skeleton skeleton-line skeleton-w-68' })
    ),
    h('span', { className: 'skeleton skeleton-line skeleton-w-20 skeleton-row-metric' }),
    h('span', { className: 'skeleton skeleton-line skeleton-w-18 skeleton-row-metric' }),
    h('span', { className: 'skeleton skeleton-circle skeleton-row-action' })
  )
}

function renderText(index) {
  return h(
    'div',
    {
      key: `skeleton-text-${index}`,
      className: 'skeleton-text-shell',
    },
    h('span', { className: 'skeleton skeleton-line skeleton-w-84' }),
    h('span', { className: 'skeleton skeleton-line skeleton-w-64' })
  )
}

function renderCircle(index) {
  return h('span', {
    key: `skeleton-circle-${index}`,
    className: 'skeleton skeleton-circle skeleton-circle-shell',
  })
}

const VARIANT_RENDERERS = {
  card: renderCard,
  row: renderRow,
  text: renderText,
  circle: renderCircle,
}

export function Skeleton({ variant = 'card', count = 1 }) {
  const safeCount = Math.max(1, Number(count) || 1)
  const renderVariant = VARIANT_RENDERERS[variant] || VARIANT_RENDERERS.card

  return h(
    'div',
    {
      className: `skeleton-group skeleton-group-${variant}`,
      'data-skeleton': variant,
      'aria-hidden': 'true',
    },
    Array.from({ length: safeCount }, (_, index) => renderVariant(index))
  )
}
