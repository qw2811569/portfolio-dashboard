import { createElement as h } from 'react'
import { C, alpha } from '../../theme.js'
import { Card, StaleBadge } from '../common'
import { buildThemeChips, buildFinMindChipContext } from '../../lib/dossierUtils.js'
import { buildPriceDeviationBadgeMeta } from '../../lib/priceDeviation.js'
import { PeerRankingBadge } from './PeerRankingBadge.jsx'
import HoldingSparkline from './HoldingSparkline.jsx'
import HoldingDrillPane from './HoldingDrillPane.jsx'
import { SupplyChainView } from './SupplyChainView.jsx'
import {
  getHoldingMarketValue,
  getHoldingReturnPct,
  getHoldingUnrealizedPnl,
} from '../../lib/holdings.js'
import { isViewModeEnabled } from '../../lib/viewModeContract.js'

const card = {
  background: `linear-gradient(180deg, ${C.card}, ${C.subtle})`,
  border: `1px solid ${C.border}`,
  borderRadius: 14,
  padding: '12px 12px',
  boxShadow: `${C.insetLine}, ${C.shadow}`,
}

const lbl = {
  fontSize: 12,
  color: C.textMute,
  letterSpacing: '0.08em',
  fontWeight: 500,
  marginBottom: 4,
}

const pc = (p) => (p == null ? C.textMute : p >= 0 ? C.text : C.down)
const pcBg = (p) => (p == null ? 'transparent' : p >= 0 ? C.upBg : C.downBg)

const badgeToneStyles = {
  muted: {
    color: C.textMute,
    background: alpha(C.textMute, '12'),
    borderColor: alpha(C.textMute, '24'),
  },
  positive: {
    color: C.textSec,
    background: C.upBg,
    borderColor: alpha(C.up, '24'),
  },
  amber: {
    color: C.textSec,
    background: C.amberBg,
    borderColor: alpha(C.amber, '24'),
  },
  'positive-strong': {
    color: C.textSec,
    background: alpha(C.up, '18'),
    borderColor: alpha(C.up, '30'),
  },
  danger: {
    color: C.down,
    background: C.downBg,
    borderColor: alpha(C.down, '28'),
  },
}

/**
 * Single Holding Row
 */
export function HoldingRow({
  holding,
  dossier = null,
  expanded = false,
  onToggle = () => {},
  onUpdateTarget = () => {},
  onUpdateAlert = () => {},
  viewMode = 'retail',
}) {
  const pnl = getHoldingUnrealizedPnl(holding)
  const pct = getHoldingReturnPct(holding)
  const value = getHoldingMarketValue(holding)
  const deviationBadge = buildPriceDeviationBadgeMeta(holding)
  const badgeTone = badgeToneStyles[deviationBadge?.tone || 'muted']
  const sparklineHistory = Array.isArray(holding.priceHistory)
    ? holding.priceHistory
    : Array.isArray(holding.dailyHistory)
      ? holding.dailyHistory
      : []
  const showPerStockDiff = isViewModeEnabled('showPerStockDiff', viewMode)

  return h(
    'div',
    null,
    // Main row
    h(
      'div',
      {
        className: expanded ? 'holding-row holding-row-expanded' : 'holding-row',
        style: {
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 44px',
          gap: 8,
          alignItems: 'center',
          padding: '12px',
          background: expanded
            ? `linear-gradient(90deg, ${C.subtleElev}, ${C.card})`
            : `linear-gradient(90deg, ${C.card}, ${alpha(C.subtle, 'f4')})`,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          marginBottom: expanded ? 0 : 4,
          transition: 'background 0.1s ease',
        },
      },
      // Name + Code + Badge + Sparkline
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
          },
        },
        h(
          'div',
          { style: { minWidth: 0, flex: '1 1 auto' } },
          null,
          h(
            'div',
            {
              style: {
                fontSize: 11,
                fontWeight: 600,
                color: C.text,
                fontFamily: 'var(--font-headline)',
              },
            },
            holding.name
          ),
          h(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                flexWrap: 'wrap',
                marginTop: 4,
              },
            },
            h('div', { className: 'tn', style: { fontSize: 11, color: C.textMute } }, holding.code),
            h(StaleBadge, {
              dossier,
              field: 'targets',
              title: 'targets freshness',
              style: { textTransform: 'none' },
            }),
            h(StaleBadge, {
              dossier,
              field: 'fundamentals',
              title: 'fundamentals freshness',
              style: { textTransform: 'none' },
            }),
            deviationBadge &&
              h(
                'span',
                {
                  title: deviationBadge.tooltip,
                  style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    maxWidth: '100%',
                    fontSize: 11,
                    lineHeight: 1.2,
                    fontWeight: 600,
                    padding: '4px 8px',
                    borderRadius: 999,
                    border: `1px solid ${badgeTone.borderColor}`,
                    background: badgeTone.background,
                    color: badgeTone.color,
                    whiteSpace: 'nowrap',
                    animation: deviationBadge.pulse
                      ? 'holding-price-deviation-pulse 1.8s ease-in-out infinite'
                      : 'none',
                  },
                },
                deviationBadge.text
              )
          ),
          h(PeerRankingBadge, { holding })
        ),
        h(HoldingSparkline, { history: sparklineHistory })
      ),

      // Qty + Cost
      h(
        'div',
        { className: 'tn', style: { fontSize: 12, color: C.textSec } },
        h('div', null, `${holding.qty.toLocaleString()} 股`),
        h(
          'div',
          { style: { fontSize: 11, color: C.textMute, fontFamily: 'var(--font-num)' } },
          `成本 ${holding.cost}`
        )
      ),

      // Price + Value
      h(
        'div',
        { className: 'tn', style: { fontSize: 12, color: C.textSec } },
        h(
          'div',
          { style: { fontWeight: 600, color: C.text, fontFamily: 'var(--font-num)' } },
          holding.price
        ),
        h(
          'div',
          { style: { fontSize: 11, color: C.textMute, fontFamily: 'var(--font-num)' } },
          value.toLocaleString()
        )
      ),

      // P&L
      h(
        'div',
        {
          style: {
            fontSize: 12,
            fontWeight: 600,
            color: pc(pnl),
            fontFamily: 'var(--font-num)',
            background: `linear-gradient(90deg, ${pcBg(pnl)}, transparent)`,
            borderRadius: 999,
            padding: '4px 8px',
            textAlign: 'center',
            border: `1px solid ${pnl == null ? C.borderSub : alpha(pc(pnl), '24')}`,
          },
        },
        h('div', null, `${pnl >= 0 ? '+' : ''}${Math.round(pnl).toLocaleString()}`),
        h(
          'div',
          { style: { fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-num)' } },
          `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
        )
      ),

      // Expand button
      h(
        'button',
        {
          type: 'button',
          'aria-label': `${expanded ? '收合' : '展開'} ${holding.name} 明細`,
          onClick: onToggle,
          style: {
            width: 44,
            height: 44,
            minWidth: 44,
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            justifySelf: 'end',
            padding: 0,
            borderRadius: 999,
            background: expanded ? alpha(C.blue, '10') : C.subtle,
            border: `1px solid ${expanded ? alpha(C.blue, '24') : C.border}`,
            color: C.textMute,
            cursor: 'pointer',
            fontSize: 14,
          },
        },
        expanded ? '▲' : '▼'
      )
    ),

    // Expanded details
    expanded &&
      h(
        'div',
        {
          style: {
            background: C.subtle,
            border: `1px solid ${C.border}`,
            borderTop: 'none',
            borderRadius: '0 0 10px 10px',
            padding: '8px 12px',
            marginBottom: 4,
          },
        },
        // 主題 chips
        (() => {
          const chips = buildThemeChips(holding.code)
          return chips.length > 0
            ? h(
                'div',
                { style: { marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4 } },
                chips.map((c) =>
                  h(
                    'span',
                    {
                      key: c.theme,
                      style: {
                        fontSize: 11,
                        padding: '4px 8px',
                        background: alpha(C.lavender, '12'),
                        color: C.text,
                        border: `1px solid ${alpha(C.lavender, '24')}`,
                        borderRadius: 999,
                      },
                    },
                    c.label
                  )
                )
              )
            : null
        })(),
        h(HoldingDrillPane, { holding, dossier, viewMode }),
        showPerStockDiff &&
          h(
            'div',
            {
              style: {
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                marginTop: 8,
                paddingTop: 8,
                borderTop: `1px solid ${C.borderSub}`,
              },
            },
            // Target price
            h(
              'div',
              null,
              h('div', { style: { ...lbl, marginBottom: 4 } }, '手動目標價'),
              h('input', {
                type: 'number',
                value: holding.targetPrice || '',
                onChange: (e) =>
                  onUpdateTarget(holding.code, e.target.value ? Number(e.target.value) : null),
                placeholder: '輸入目標價',
                style: {
                  width: '100%',
                  background: C.subtle,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: '4px 8px',
                  color: C.text,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                },
              })
            ),

            // Alert
            h(
              'div',
              null,
              h('div', { style: { ...lbl, marginBottom: 4 } }, '提醒筆記'),
              h('input', {
                type: 'text',
                value: holding.alert || '',
                onChange: (e) => onUpdateAlert(holding.code, e.target.value),
                placeholder: '如：跌破月線',
                style: {
                  width: '100%',
                  background: C.subtle,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: '4px 8px',
                  color: C.text,
                  fontSize: 11,
                },
              })
            )
          ),

        // Supply chain view
        h(SupplyChainView, { code: holding.code, name: holding.name }),

        // FinMind data panel
        holding.finmind &&
          h(
            'div',
            {
              style: {
                marginTop: 8,
                paddingTop: 8,
                borderTop: `1px solid ${C.border}`,
              },
            },
            h('div', { style: { ...lbl, marginBottom: 4 } }, '最近抓到的補充資料'),
            (() => {
              const finmindText = buildFinMindChipContext(holding.finmind)
              return finmindText
                ? h(
                    'div',
                    {
                      style: {
                        fontSize: 11,
                        color: C.textSec,
                        lineHeight: 1.6,
                        whiteSpace: 'pre-line',
                      },
                    },
                    finmindText
                  )
                : h(
                    'div',
                    { style: { fontSize: 11, color: C.textMute } },
                    '這檔目前還沒抓到補充資料'
                  )
            })()
          ),

        // Additional info
        holding.type &&
          h(
            'div',
            { style: { fontSize: 11, color: C.textMute, marginTop: 8 } },
            '類型：',
            holding.type
          )
      )
  )
}

/**
 * Holdings Table
 */
export function HoldingsTable({
  holdings = [],
  dossierByCode = new Map(),
  expandedStock = null,
  setExpandedStock = () => {},
  onUpdateTarget = () => {},
  onUpdateAlert = () => {},
  staleStatus = 'fresh',
  sortBy = 'code',
  sortDir = 'asc',
  viewMode = 'retail',
}) {
  if (!holdings || holdings.length === 0) {
    return h(
      'div',
      { style: { ...card, textAlign: 'center', padding: '32px 16px' } },
      h('div', { style: { fontSize: 28, marginBottom: 8, opacity: 0.6 } }, '∅'),
      h('div', { style: { fontSize: 11, color: C.textSec, fontWeight: 600 } }, '尚無持股'),
      h(
        'div',
        { style: { fontSize: 12, color: C.textMute, marginTop: 4 } },
        '上傳成交記錄或手動新增持股'
      )
    )
  }

  // Sort holdings
  const sorted = [...holdings].sort((a, b) => {
    let aVal, bVal
    switch (sortBy) {
      case 'code':
        aVal = a.code
        bVal = b.code
        break
      case 'value':
        aVal = getHoldingMarketValue(a)
        bVal = getHoldingMarketValue(b)
        break
      case 'pnl':
        aVal = getHoldingUnrealizedPnl(a)
        bVal = getHoldingUnrealizedPnl(b)
        break
      case 'pct':
        aVal = getHoldingReturnPct(a)
        bVal = getHoldingReturnPct(b)
        break
      default:
        aVal = a.code
        bVal = b.code
    }
    if (sortDir === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
    }
    return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
  })

  return h(
    Card,
    null,
    h(
      'style',
      null,
      `@keyframes holding-price-deviation-pulse { 0% { box-shadow: 0 0 0 0 ${alpha(C.up, 0.18)}; } 50% { box-shadow: 0 0 0 5px ${alpha(C.up, 0.06)}; } 100% { box-shadow: 0 0 0 0 ${alpha(C.up, 0)}; } }`
    ),
    h(
      'div',
      {
        style: {
          ...lbl,
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        },
      },
      `持股明細 · ${holdings.length}檔`,
      h(StaleBadge, { status: staleStatus, title: 'holdings panel freshness' })
    ),

    // Header
    h(
      'div',
      {
        style: {
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 40px',
          gap: 8,
          padding: '8px 12px',
          fontSize: 11,
          color: C.textMute,
          fontWeight: 500,
          letterSpacing: '0.08em',
        },
      },
      h('div', null, '股票'),
      h('div', null, '數量 / 成本'),
      h('div', null, '股價 / 市值'),
      h('div', null, '損益'),
      h('div', null, '')
    ),

    // Rows
    h(
      'div',
      null,
      sorted.map((holding) =>
        h(HoldingRow, {
          key: holding.code,
          holding,
          dossier: dossierByCode.get(holding.code) || null,
          expanded: expandedStock === holding.code,
          onToggle: () => setExpandedStock(expandedStock === holding.code ? null : holding.code),
          onUpdateTarget,
          onUpdateAlert,
          viewMode,
        })
      )
    )
  )
}
