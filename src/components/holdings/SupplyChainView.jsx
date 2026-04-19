import { createElement as h } from 'react'
import { C } from '../../theme.js'
import { Card } from '../common'
import { getSupplyChain } from '../../lib/dataAdapters/index.js'

const lbl = {
  fontSize: 10,
  color: C.textMute,
  letterSpacing: '0.06em',
  fontWeight: 600,
  marginBottom: 5,
}

const chipStyle = {
  fontSize: 10,
  padding: '3px 8px',
  borderRadius: 4,
  background: C.fillPrimary,
  color: C.text,
  display: 'inline-block',
  marginRight: 4,
  marginBottom: 4,
}

const linkChipStyle = {
  ...chipStyle,
  background: C.fillInfo,
  cursor: 'pointer',
  textDecoration: 'underline',
}

/**
 * Supply Chain Visualization Component
 * Shows upstream → company → downstream relationships
 */
export function SupplyChainView({ code, name, onStockClick }) {
  const chain = getSupplyChain(code)

  if (!chain) {
    return h(
      Card,
      { style: { padding: 12 } },
      h('div', { style: { ...lbl, color: C.textMute } }, '供應鏈資料'),
      h('div', { style: { fontSize: 11, color: C.textSec } }, '暫無供應鏈資料')
    )
  }

  const hasUpstream = chain.upstream?.length > 0
  const hasDownstream = chain.downstream?.length > 0
  const hasCustomers = chain.customers?.length > 0
  const hasSuppliers = chain.suppliers?.length > 0
  const hasCompetitors = chain.competitors?.length > 0

  if (!hasUpstream && !hasDownstream && !hasCustomers && !hasSuppliers && !hasCompetitors) {
    return h(
      Card,
      { style: { padding: 12 } },
      h('div', { style: { ...lbl, color: C.textMute } }, '供應鏈資料'),
      h('div', { style: { fontSize: 11, color: C.textSec } }, '暫無供應鏈資料')
    )
  }

  return h(
    Card,
    { style: { padding: '12px 14px' } },
    // Title
    h('div', { style: { ...lbl, color: C.textSec, marginBottom: 8 } }, '供應鏈關係'),

    // Upstream
    hasUpstream &&
      h(
        'div',
        { style: { marginBottom: 10 } },
        h('div', { style: { ...lbl, marginBottom: 4 } }, '上游'),
        h(
          'div',
          null,
          chain.upstream.map((s) =>
            s.code && onStockClick
              ? h(
                  'span',
                  {
                    key: s.code,
                    style: linkChipStyle,
                    onClick: () => onStockClick(s.code),
                  },
                  `${s.name} (${s.code})`
                )
              : h(
                  'span',
                  { key: s.name, style: chipStyle },
                  `${s.name}${s.product ? ` (${s.product})` : ''}`
                )
          )
        )
      ),

    // Company (center)
    h(
      'div',
      {
        style: {
          textAlign: 'center',
          padding: '8px 12px',
          background: C.fillPrimary,
          borderRadius: 6,
          margin: '10px 0',
        },
      },
      h('div', { style: { fontSize: 12, fontWeight: 600, color: C.text } }, name),
      h('div', { style: { fontSize: 10, color: C.textSec } }, code)
    ),

    // Downstream
    hasDownstream &&
      h(
        'div',
        { style: { marginBottom: 10 } },
        h('div', { style: { ...lbl, marginBottom: 4 } }, '下游'),
        h(
          'div',
          null,
          chain.downstream.map((s) =>
            s.code && onStockClick
              ? h(
                  'span',
                  {
                    key: s.code,
                    style: linkChipStyle,
                    onClick: () => onStockClick(s.code),
                  },
                  `${s.name} (${s.code})`
                )
              : h(
                  'span',
                  { key: s.name, style: chipStyle },
                  `${s.name}${s.product ? ` (${s.product})` : ''}${s.revenueShare ? ` ${s.revenueShare}營收` : ''}`
                )
          )
        )
      ),

    // Customers (if separate from downstream)
    hasCustomers &&
      !hasDownstream &&
      h(
        'div',
        { style: { marginBottom: 10 } },
        h('div', { style: { ...lbl, marginBottom: 4 } }, '主要客戶'),
        h(
          'div',
          null,
          chain.customers.map((customer) =>
            h('span', { key: customer, style: chipStyle }, customer)
          )
        )
      ),

    // Suppliers (if separate from upstream)
    hasSuppliers &&
      !hasUpstream &&
      h(
        'div',
        { style: { marginBottom: 10 } },
        h('div', { style: { ...lbl, marginBottom: 4 } }, '主要供應商'),
        h(
          'div',
          null,
          chain.suppliers.map((supplier) =>
            h('span', { key: supplier, style: chipStyle }, supplier)
          )
        )
      ),

    // Competitors
    hasCompetitors &&
      h(
        'div',
        {
          style: {
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px solid ${C.border}`,
          },
        },
        h('div', { style: { ...lbl, marginBottom: 4 } }, '競爭對手'),
        h(
          'div',
          null,
          chain.competitors.map((competitor) =>
            h(
              'span',
              { key: competitor, style: { ...chipStyle, background: C.fillWarning } },
              competitor
            )
          )
        )
      )
  )
}

export default SupplyChainView
