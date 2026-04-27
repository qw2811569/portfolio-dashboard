import { createElement as h, useEffect, useRef, useState } from 'react'
import { C, alpha } from '../../theme.js'
import { Button, Card, StaleBadge } from '../common'
import { EmptyState } from '../common/EmptyState.jsx'
import { Skeleton } from '../common/Skeleton.jsx'
import { buildThemeChips, buildFinMindChipContext } from '../../lib/dossierUtils.js'
import { buildPriceDeviationBadgeMeta } from '../../lib/priceDeviation.js'
import { THESIS_FORM_FIELDS, validateThesisForm } from '../../hooks/useThesisTracking.js'
import { PeerRankingBadge } from './PeerRankingBadge.jsx'
import HoldingSparkline from './HoldingSparkline.jsx'
import HoldingDrillPane from './HoldingDrillPane.jsx'
import HoldingDetailPane from './HoldingDetailPane.jsx'
import { SupplyChainView } from './SupplyChainView.jsx'
import {
  getHoldingMarketValue,
  getHoldingReturnPct,
  getHoldingUnrealizedPnl,
} from '../../lib/holdings.js'
import { isViewModeEnabled } from '../../lib/viewModeContract.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'

const lbl = {
  fontSize: 12,
  color: C.textMute,
  letterSpacing: '0.08em',
  fontWeight: 500,
  marginBottom: 4,
}

const pc = (p) => (p == null ? C.textMute : p >= 0 ? C.text : C.down)
const pcBg = (p) => (p == null ? 'transparent' : p >= 0 ? C.upBg : C.downBg)
const THESIS_QUICK_FORM_FIELDS = ['reason', 'expectation', 'invalidation']

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

function HoldingsFilteredEmptyState({ hasActiveFilters = false, onClearFilters = () => {} }) {
  const showClearAction = hasActiveFilters && typeof onClearFilters === 'function'

  return h(
    Card,
    {
      'data-testid': 'holdings-filtered-empty-state',
      style: {
        marginBottom: 8,
        textAlign: 'center',
        padding: '28px 20px',
        borderStyle: 'solid',
        borderColor: alpha(C.border, 'd8'),
        background: alpha(C.card, 'f6'),
      },
    },
    h(
      'div',
      {
        style: {
          display: 'grid',
          justifyItems: 'center',
          gap: 12,
        },
      },
      h(
        'div',
        {
          style: {
            fontSize: 11,
            color: C.textMute,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          },
        },
        '篩選結果'
      ),
      h(
        'div',
        {
          style: {
            fontSize: 24,
            fontWeight: 600,
            color: C.text,
            lineHeight: 1.15,
            fontFamily: 'var(--font-headline)',
          },
        },
        '目前篩選沒符合'
      ),
      h(
        'div',
        {
          style: {
            maxWidth: 420,
            fontSize: 12,
            color: C.textSec,
            lineHeight: 1.8,
          },
        },
        showClearAction
          ? '試試清除篩選、換一個 chip，或把搜尋字詞放寬一點。'
          : '目前清單暫時沒有符合的持股，稍後重新整理再看一次。'
      ),
      showClearAction &&
        h(
          Button,
          {
            'data-testid': 'holdings-filtered-empty-clear',
            onClick: onClearFilters,
            style: {
              marginTop: 4,
              background: alpha(C.cta, '12'),
              border: `1px solid ${alpha(C.cta, '28')}`,
              color: C.text,
              padding: '10px 16px',
              textTransform: 'none',
              letterSpacing: '0.02em',
            },
          },
          '清除篩選'
        )
    )
  )
}

function getThesisQuickDraft(dossier = null) {
  const thesis = dossier?.thesis || {}
  return {
    reason: String(thesis.reason || thesis.statement || thesis.summary || '').trim(),
    expectation: String(thesis.expectation || '').trim(),
    invalidation: String(thesis.invalidation || '').trim(),
  }
}

function hasHoldingThesis(dossier = null) {
  const thesis = dossier?.thesis
  const statement = String(
    thesis?.statement ||
      thesis?.reason ||
      thesis?.summary ||
      thesis?.text ||
      thesis?.expectation ||
      ''
  )
    .replace(/\s+/g, ' ')
    .trim()
  const pillars = Array.isArray(thesis?.pillars)
    ? thesis.pillars.filter((pillar) => String(pillar?.label || pillar?.text || '').trim())
    : []

  return Boolean(statement || pillars.length > 0)
}

function ThesisQuickFormCard({
  code = '',
  name = '',
  values = {},
  errors = {},
  saving = false,
  onChange = () => {},
  onSave = () => {},
  onCancel = () => {},
}) {
  return h(
    'div',
    {
      'data-testid': `holding-thesis-quick-form-${code || 'unknown'}`,
      style: {
        marginTop: 8,
        padding: '12px 12px',
        borderRadius: 12,
        border: `1px solid ${alpha(C.fillTeal, '28')}`,
        background: C.card,
      },
    },
    h(
      'div',
      {
        style: {
          fontSize: 11,
          color: C.textMute,
          letterSpacing: '0.08em',
          fontWeight: 700,
          marginBottom: 6,
        },
      },
      '寫理由'
    ),
    h(
      'div',
      {
        style: {
          fontSize: 12,
          color: C.textSec,
          lineHeight: 1.7,
          marginBottom: 10,
        },
      },
      `${name || code} 還沒整理投資理由，先補最小版本也夠用。`
    ),
    ...THESIS_QUICK_FORM_FIELDS.map((fieldKey) => {
      const field = THESIS_FORM_FIELDS[fieldKey]
      const error = String(errors?.[fieldKey] || '').trim()
      return h(
        'label',
        {
          key: fieldKey,
          style: {
            display: 'grid',
            gap: 6,
            marginBottom: 10,
            fontSize: 12,
            color: C.textSec,
          },
        },
        field.label,
        h('textarea', {
          value: values?.[fieldKey] || '',
          rows: fieldKey === 'expectation' ? 2 : 3,
          placeholder: field.placeholder,
          onChange: (event) => onChange(fieldKey, event.target.value),
          style: {
            width: '100%',
            resize: 'vertical',
            background: C.card,
            border: `1px solid ${error ? alpha(C.down, '36') : C.border}`,
            borderRadius: C.radii.md,
            padding: '10px 12px',
            color: C.text,
            fontSize: 13,
            lineHeight: 1.6,
            boxSizing: 'border-box',
          },
        }),
        error
          ? h(
              'span',
              {
                style: {
                  fontSize: 11,
                  color: C.down,
                },
              },
              error
            )
          : null
      )
    }),
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          flexWrap: 'wrap',
        },
      },
      h(
        'button',
        {
          type: 'button',
          onClick: onCancel,
          style: {
            minHeight: 40,
            padding: '8px 12px',
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: C.card,
            color: C.textSec,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
          },
        },
        '先收起'
      ),
      h(
        'button',
        {
          type: 'button',
          disabled: saving,
          onClick: onSave,
          style: {
            minHeight: 40,
            padding: '8px 14px',
            borderRadius: 8,
            border: 'none',
            background: saving ? C.subtle : alpha(C.fillTeal, '36'),
            color: saving ? C.textMute : C.onFill,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 700,
          },
        },
        saving ? '儲存中...' : '存成 thesis'
      )
    )
  )
}

function HoldingExpandedDetails({
  holding,
  dossier = null,
  onUpdateTarget = () => {},
  onUpdateAlert = () => {},
  viewMode = 'retail',
  thesisQuickForm = null,
  thesisQuickFormErrors = {},
  thesisSaving = false,
  onChangeThesisQuickForm = () => {},
  onSaveThesisQuickForm = () => {},
  onCancelThesisQuickForm = () => {},
}) {
  const showPerStockDiff = isViewModeEnabled('showPerStockDiff', viewMode)

  return h(
    'div',
    null,
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
                    background: alpha(C.neutralIron, '12'),
                    color: C.text,
                    border: `1px solid ${alpha(C.neutralIron, '24')}`,
                    borderRadius: 8,
                  },
                },
                c.label
              )
            )
          )
        : null
    })(),
    h(HoldingDrillPane, { holding, dossier, viewMode }),
    thesisQuickForm &&
      h(ThesisQuickFormCard, {
        code: holding.code,
        name: holding.name,
        values: thesisQuickForm,
        errors: thesisQuickFormErrors,
        saving: thesisSaving,
        onChange: onChangeThesisQuickForm,
        onSave: onSaveThesisQuickForm,
        onCancel: onCancelThesisQuickForm,
      }),
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
              minHeight: 44,
              background: C.subtle,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '10px 8px',
              color: C.text,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              boxSizing: 'border-box',
            },
          })
        ),
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
              minHeight: 44,
              background: C.subtle,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '10px 8px',
              color: C.text,
              fontSize: 11,
              boxSizing: 'border-box',
            },
          })
        )
      ),
    h(SupplyChainView, { code: holding.code, name: holding.name }),
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
            : h('div', { style: { fontSize: 11, color: C.textMute } }, '這檔目前還沒抓到補充資料')
        })()
      ),
    holding.type &&
      h('div', { style: { fontSize: 11, color: C.textMute, marginTop: 8 } }, '類型：', holding.type)
  )
}

/**
 * Single Holding Row
 */
export function HoldingRow({
  holding,
  dossier = null,
  expanded = false,
  rowTone = 'paper',
  detailOpen = false,
  onToggle = () => {},
  onOpenDetail = () => {},
  onUpdateTarget = () => {},
  onUpdateAlert = () => {},
  viewMode = 'retail',
  thesisWriteEnabled = false,
  onOpenThesisQuickForm = () => {},
  detailButtonRef = null,
  thesisQuickForm = null,
  thesisQuickFormErrors = {},
  thesisSaving = false,
  onChangeThesisQuickForm = () => {},
  onSaveThesisQuickForm = () => {},
  onCancelThesisQuickForm = () => {},
}) {
  const pnl = getHoldingUnrealizedPnl(holding)
  const pct = getHoldingReturnPct(holding)
  const value = getHoldingMarketValue(holding)
  const rowBackground = rowTone === 'alt' ? alpha(C.paper, '8c') : alpha(C.paper, 'd4')
  const deviationBadge = buildPriceDeviationBadgeMeta(holding)
  const badgeTone = badgeToneStyles[deviationBadge?.tone || 'muted']
  const sparklineHistory = Array.isArray(holding.priceHistory)
    ? holding.priceHistory
    : Array.isArray(holding.dailyHistory)
      ? holding.dailyHistory
      : []

  return h(
    'div',
    null,
    // Main row
    h(
      'div',
      {
        className: expanded ? 'holding-row holding-row-expanded' : 'holding-row',
        'data-holding-code': holding.code,
        style: {
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
          gap: 8,
          alignItems: 'center',
          padding: '12px',
          background: expanded ? C.surfaceMuted : rowBackground,
          border: `1px solid ${C.border}`,
          borderRadius: C.radii.md,
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
            thesisWriteEnabled &&
              !hasHoldingThesis(dossier) &&
              h(
                'button',
                {
                  type: 'button',
                  'data-testid': `holding-write-thesis-${holding.code}`,
                  onClick: () => onOpenThesisQuickForm(holding, dossier),
                  style: {
                    minHeight: 28,
                    padding: '4px 8px',
                    borderRadius: 8,
                    border: `1px solid ${alpha(C.fillTeal, '32')}`,
                    background: alpha(C.fillTeal, '10'),
                    color: C.textSec,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  },
                },
                '寫理由'
              ),
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
                    borderRadius: 8,
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
            background: pcBg(pnl),
            borderRadius: 8,
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

      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifySelf: 'end',
            gap: 6,
          },
        },
        h(
          'button',
          {
            ref: detailButtonRef,
            type: 'button',
            'data-testid': `holding-open-detail-${holding.code}`,
            'aria-label': `打開 ${holding.name} 詳情`,
            onClick: onOpenDetail,
            style: {
              minWidth: 58,
              minHeight: 44,
              padding: '0 12px',
              borderRadius: 8,
              background: detailOpen ? alpha(C.fillTeal, '18') : alpha(C.card, 'f4'),
              border: `1px solid ${detailOpen ? alpha(C.fillTeal, '32') : C.border}`,
              color: detailOpen ? C.text : C.textSec,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: 'nowrap',
            },
          },
          '詳情'
        ),
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
              padding: 0,
              borderRadius: 8,
              background: expanded ? alpha(C.ink, '10') : C.subtle,
              border: `1px solid ${expanded ? alpha(C.ink, '24') : C.border}`,
              color: C.textMute,
              cursor: 'pointer',
              fontSize: 14,
            },
          },
          expanded ? '▲' : '▼'
        )
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
            borderRadius: `0 0 ${C.radii.md} ${C.radii.md}`,
            padding: '8px 12px',
            marginBottom: 4,
          },
        },
        h(HoldingExpandedDetails, {
          holding,
          dossier,
          onUpdateTarget,
          onUpdateAlert,
          viewMode,
          thesisQuickForm,
          thesisQuickFormErrors,
          thesisSaving,
          onChangeThesisQuickForm,
          onSaveThesisQuickForm,
          onCancelThesisQuickForm,
        })
      )
  )
}

function HoldingMobileCard({
  holding,
  dossier = null,
  expanded = false,
  rowTone = 'paper',
  detailOpen = false,
  onToggle = () => {},
  onOpenDetail = () => {},
  onUpdateTarget = () => {},
  onUpdateAlert = () => {},
  viewMode = 'retail',
  thesisWriteEnabled = false,
  onOpenThesisQuickForm = () => {},
  detailButtonRef = null,
  thesisQuickForm = null,
  thesisQuickFormErrors = {},
  thesisSaving = false,
  onChangeThesisQuickForm = () => {},
  onSaveThesisQuickForm = () => {},
  onCancelThesisQuickForm = () => {},
}) {
  const pnl = getHoldingUnrealizedPnl(holding)
  const pct = getHoldingReturnPct(holding)
  const value = getHoldingMarketValue(holding)
  const rowBackground = rowTone === 'alt' ? alpha(C.paper, '8c') : alpha(C.paper, 'd4')
  const deviationBadge = buildPriceDeviationBadgeMeta(holding)
  const badgeTone = badgeToneStyles[deviationBadge?.tone || 'muted']
  const sparklineHistory = Array.isArray(holding.priceHistory)
    ? holding.priceHistory
    : Array.isArray(holding.dailyHistory)
      ? holding.dailyHistory
      : []

  return h(
    'div',
    null,
    h(
      'div',
      {
        'data-testid': 'holdings-mobile-card',
        style: {
          display: 'grid',
          gap: 12,
          padding: '14px 14px 12px',
          background: expanded ? C.surfaceMuted : rowBackground,
          border: `1px solid ${C.border}`,
          borderRadius: expanded ? '16px 16px 0 0' : 16,
          marginBottom: expanded ? 0 : 8,
        },
      },
      h(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 10,
          },
        },
        h(
          'div',
          {
            style: {
              display: 'grid',
              gap: 6,
              minWidth: 0,
              flex: 1,
            },
          },
          h(
            'div',
            {
              style: {
                fontSize: 14,
                fontWeight: 700,
                color: C.text,
                fontFamily: 'var(--font-headline)',
                lineHeight: 1.3,
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
                gap: 6,
                flexWrap: 'wrap',
              },
            },
            h(
              'span',
              { className: 'tn', style: { fontSize: 11, color: C.textMute } },
              holding.code
            ),
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
            thesisWriteEnabled &&
              !hasHoldingThesis(dossier) &&
              h(
                'button',
                {
                  type: 'button',
                  'data-testid': `holding-write-thesis-${holding.code}`,
                  onClick: () => onOpenThesisQuickForm(holding, dossier),
                  style: {
                    minHeight: 28,
                    padding: '4px 8px',
                    borderRadius: 8,
                    border: `1px solid ${alpha(C.fillTeal, '32')}`,
                    background: alpha(C.fillTeal, '10'),
                    color: C.textSec,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  },
                },
                '寫理由'
              ),
            deviationBadge &&
              h(
                'span',
                {
                  title: deviationBadge.tooltip,
                  style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontSize: 11,
                    lineHeight: 1.2,
                    fontWeight: 600,
                    padding: '4px 8px',
                    borderRadius: 8,
                    border: `1px solid ${badgeTone.borderColor}`,
                    background: badgeTone.background,
                    color: badgeTone.color,
                    whiteSpace: 'nowrap',
                  },
                },
                deviationBadge.text
              )
          ),
          h(PeerRankingBadge, { holding })
        ),
        h(
          'div',
          {
            style: {
              display: 'grid',
              gap: 8,
              justifyItems: 'end',
            },
          },
          h(
            'button',
            {
              ref: detailButtonRef,
              type: 'button',
              'data-testid': `holding-open-detail-${holding.code}`,
              'aria-label': `打開 ${holding.name} 詳情`,
              onClick: onOpenDetail,
              style: {
                minWidth: 64,
                minHeight: 44,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 12px',
                borderRadius: 8,
                background: detailOpen ? alpha(C.fillTeal, '18') : alpha(C.card, 'f4'),
                border: `1px solid ${detailOpen ? alpha(C.fillTeal, '32') : C.border}`,
                color: detailOpen ? C.text : C.textSec,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 700,
                whiteSpace: 'nowrap',
              },
            },
            '詳情'
          ),
          h(
            'button',
            {
              type: 'button',
              'aria-label': `${expanded ? '收合' : '展開'} ${holding.name} 明細`,
              onClick: onToggle,
              style: {
                minWidth: 80,
                minHeight: 44,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 12px',
                borderRadius: 8,
                background: expanded ? alpha(C.ink, '10') : C.subtle,
                border: `1px solid ${expanded ? alpha(C.ink, '24') : C.border}`,
                color: C.textSec,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              },
            },
            expanded ? '收合明細' : '展開明細'
          )
        )
      ),
      h(HoldingSparkline, { history: sparklineHistory }),
      h(
        'div',
        {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 8,
          },
        },
        h(
          'div',
          {
            style: {
              borderRadius: 12,
              border: `1px solid ${C.borderSub}`,
              background: C.subtle,
              padding: '10px 10px',
            },
          },
          h('div', { style: { fontSize: 10, color: C.textMute, marginBottom: 4 } }, '數量 / 成本'),
          h(
            'div',
            { className: 'tn', style: { fontSize: 12, color: C.textSec } },
            `${holding.qty.toLocaleString()} 股`
          ),
          h(
            'div',
            { className: 'tn', style: { fontSize: 11, color: C.textMute } },
            `成本 ${holding.cost}`
          )
        ),
        h(
          'div',
          {
            style: {
              borderRadius: 12,
              border: `1px solid ${C.borderSub}`,
              background: C.subtle,
              padding: '10px 10px',
            },
          },
          h('div', { style: { fontSize: 10, color: C.textMute, marginBottom: 4 } }, '股價 / 市值'),
          h(
            'div',
            { className: 'tn', style: { fontSize: 12, fontWeight: 600, color: C.text } },
            holding.price
          ),
          h(
            'div',
            { className: 'tn', style: { fontSize: 11, color: C.textMute } },
            value.toLocaleString()
          )
        ),
        h(
          'div',
          {
            style: {
              borderRadius: 12,
              border: `1px solid ${pnl == null ? C.borderSub : alpha(pc(pnl), '24')}`,
              background: pcBg(pnl),
              padding: '10px 10px',
            },
          },
          h('div', { style: { fontSize: 10, color: C.textMute, marginBottom: 4 } }, '未實現損益'),
          h(
            'div',
            {
              className: 'tn',
              style: {
                fontSize: 13,
                fontWeight: 700,
                color: pc(pnl),
              },
            },
            `${pnl >= 0 ? '+' : ''}${Math.round(pnl).toLocaleString()}`
          ),
          h(
            'div',
            { className: 'tn', style: { fontSize: 11, color: pc(pnl) } },
            `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
          )
        ),
        h(
          'div',
          {
            style: {
              borderRadius: 12,
              border: `1px solid ${C.borderSub}`,
              background: C.subtle,
              padding: '10px 10px',
            },
          },
          h('div', { style: { fontSize: 10, color: C.textMute, marginBottom: 4 } }, '操作提示'),
          h(
            'div',
            {
              style: {
                fontSize: 11,
                color: C.textSec,
                lineHeight: 1.6,
              },
            },
            deviationBadge?.tooltip || holding.alert || '先看明細，再決定是否調整投資理由。'
          )
        )
      )
    ),
    expanded &&
      h(
        'div',
        {
          style: {
            background: C.subtle,
            border: `1px solid ${C.border}`,
            borderTop: 'none',
            borderRadius: '0 0 16px 16px',
            padding: '10px 12px 12px',
            marginBottom: 8,
          },
        },
        h(HoldingExpandedDetails, {
          holding,
          dossier,
          onUpdateTarget,
          onUpdateAlert,
          viewMode,
          thesisQuickForm,
          thesisQuickFormErrors,
          thesisSaving,
          onChangeThesisQuickForm,
          onSaveThesisQuickForm,
          onCancelThesisQuickForm,
        })
      )
  )
}

/**
 * Holdings Table
 */
export function HoldingsTable({
  holdings = [],
  loading = false,
  totalHoldingsCount = 0,
  hasActiveFilters = false,
  onClearFilters = () => {},
  dossierByCode = new Map(),
  expandedStock = null,
  setExpandedStock = () => {},
  detailStockCode = null,
  detailDossier = null,
  onOpenDetail = () => {},
  onCloseDetail = () => {},
  onUpdateTarget = () => {},
  onUpdateAlert = () => {},
  staleStatus = 'fresh',
  sortBy = 'code',
  sortDir = 'asc',
  viewMode = 'retail',
  onAddHoldings = null,
  thesisWriteEnabled = false,
  onUpsertThesis = async () => ({ success: false }),
}) {
  const isMobile = useIsMobile()
  const [thesisQuickForm, setThesisQuickForm] = useState(null)
  const [thesisQuickFormErrors, setThesisQuickFormErrors] = useState({})
  const [thesisSaving, setThesisSaving] = useState(false)
  const thesisQuickFormCode = thesisQuickForm?.code || ''
  const detailTriggerRefs = useRef(new Map())
  const lastDetailTriggerCodeRef = useRef('')
  const pendingDetailFocusReturnRef = useRef(false)

  useEffect(() => {
    if (detailStockCode || !pendingDetailFocusReturnRef.current) return

    pendingDetailFocusReturnRef.current = false
    const node = detailTriggerRefs.current.get(lastDetailTriggerCodeRef.current)
    if (node && typeof node.focus === 'function') {
      window.requestAnimationFrame(() => {
        node.focus()
      })
    }
  }, [detailStockCode])

  const closeThesisQuickForm = () => {
    setThesisQuickForm(null)
    setThesisQuickFormErrors({})
    setThesisSaving(false)
  }

  const openThesisQuickForm = (holding, dossier = null) => {
    setExpandedStock(holding?.code || null)
    setThesisQuickForm({
      code: holding?.code || '',
      name: holding?.name || '',
      ...getThesisQuickDraft(dossier),
    })
    setThesisQuickFormErrors({})
  }

  const handleThesisQuickFormChange = (fieldKey, value) => {
    setThesisQuickForm((current) =>
      current
        ? {
            ...current,
            [fieldKey]: value,
          }
        : current
    )
    setThesisQuickFormErrors((current) => {
      if (!current?.[fieldKey]) return current
      return {
        ...current,
        [fieldKey]: '',
      }
    })
  }

  const handleThesisQuickFormSave = async () => {
    if (!thesisQuickFormCode || !thesisWriteEnabled) return

    const payload = {
      reason: String(thesisQuickForm?.reason || '').trim(),
      expectation: String(thesisQuickForm?.expectation || '').trim(),
      invalidation: String(thesisQuickForm?.invalidation || '').trim(),
    }
    const validation = validateThesisForm(payload)
    if (!validation.valid) {
      setThesisQuickFormErrors(validation.errors)
      return
    }

    setThesisSaving(true)
    try {
      const result = await onUpsertThesis(thesisQuickFormCode, payload)
      if (result === false || result?.success === false) {
        setThesisQuickFormErrors({
          reason: '這次沒有存進去，稍後再試一次。',
        })
        return
      }
      closeThesisQuickForm()
    } finally {
      setThesisSaving(false)
    }
  }

  const toggleExpandedStock = (code) => {
    const nextCode = expandedStock === code ? null : code
    setExpandedStock(nextCode)
    if (nextCode !== code && thesisQuickFormCode === code) {
      closeThesisQuickForm()
    }
  }

  const handleOpenDetail = (code) => {
    const normalizedCode = String(code || '').trim()
    if (!normalizedCode) return
    lastDetailTriggerCodeRef.current = normalizedCode
    pendingDetailFocusReturnRef.current = true
    onOpenDetail(normalizedCode)
  }

  const handleCloseDetail = () => {
    const normalizedCode = String(detailStockCode || '').trim()
    if (normalizedCode) {
      lastDetailTriggerCodeRef.current = normalizedCode
      pendingDetailFocusReturnRef.current = true
    }
    onCloseDetail()
  }

  const registerDetailTriggerRef = (code) => (node) => {
    if (!node) {
      detailTriggerRefs.current.delete(code)
      return
    }
    detailTriggerRefs.current.set(code, node)
  }

  if (loading) {
    return h(
      Card,
      null,
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
        '持股明細 · 載入中',
        h(StaleBadge, { status: staleStatus, title: 'holdings panel freshness' })
      ),
      h(Skeleton, { variant: 'row', count: 5 })
    )
  }

  if (!holdings || holdings.length === 0) {
    if (Number(totalHoldingsCount) > 0 || hasActiveFilters) {
      return h(HoldingsFilteredEmptyState, { hasActiveFilters, onClearFilters })
    }
    return h(EmptyState, { resource: 'holdings', onAction: onAddHoldings })
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

  if (isMobile) {
    return h(
      'div',
      null,
      h(
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
        h(
          'div',
          {
            'data-testid': 'holdings-mobile-card-list',
            style: {
              display: 'grid',
              gap: 8,
            },
          },
          sorted.map((holding, index) =>
            h(HoldingMobileCard, {
              key: holding.code,
              holding,
              rowTone: index % 2 === 0 ? 'paper' : 'alt',
              dossier: dossierByCode.get(holding.code) || null,
              expanded: expandedStock === holding.code,
              detailOpen: detailStockCode === holding.code,
              onToggle: () => toggleExpandedStock(holding.code),
              onOpenDetail: () => handleOpenDetail(holding.code),
              onUpdateTarget,
              onUpdateAlert,
              viewMode,
              thesisWriteEnabled,
              onOpenThesisQuickForm: openThesisQuickForm,
              detailButtonRef: registerDetailTriggerRef(holding.code),
              thesisQuickForm:
                thesisQuickFormCode === holding.code
                  ? {
                      reason: thesisQuickForm.reason,
                      expectation: thesisQuickForm.expectation,
                      invalidation: thesisQuickForm.invalidation,
                    }
                  : null,
              thesisQuickFormErrors:
                thesisQuickFormCode === holding.code ? thesisQuickFormErrors : {},
              thesisSaving: thesisQuickFormCode === holding.code ? thesisSaving : false,
              onChangeThesisQuickForm: handleThesisQuickFormChange,
              onSaveThesisQuickForm: handleThesisQuickFormSave,
              onCancelThesisQuickForm: closeThesisQuickForm,
            })
          )
        )
      ),
      h(HoldingDetailPane, {
        open: Boolean(detailStockCode && detailDossier),
        detail: detailDossier,
        onClose: handleCloseDetail,
      })
    )
  }

  return h(
    'div',
    null,
    h(
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
            gridTemplateColumns: '2fr 1fr 1fr 1fr 110px',
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
        h('div', { style: { textAlign: 'right' } }, '操作')
      ),

      // Rows
      h(
        'div',
        null,
        sorted.map((holding, index) =>
          h(HoldingRow, {
            key: holding.code,
            holding,
            rowTone: index % 2 === 0 ? 'paper' : 'alt',
            dossier: dossierByCode.get(holding.code) || null,
            expanded: expandedStock === holding.code,
            detailOpen: detailStockCode === holding.code,
            onToggle: () => toggleExpandedStock(holding.code),
            onOpenDetail: () => handleOpenDetail(holding.code),
            onUpdateTarget,
            onUpdateAlert,
            viewMode,
            thesisWriteEnabled,
            onOpenThesisQuickForm: openThesisQuickForm,
            detailButtonRef: registerDetailTriggerRef(holding.code),
            thesisQuickForm:
              thesisQuickFormCode === holding.code
                ? {
                    reason: thesisQuickForm.reason,
                    expectation: thesisQuickForm.expectation,
                    invalidation: thesisQuickForm.invalidation,
                  }
                : null,
            thesisQuickFormErrors:
              thesisQuickFormCode === holding.code ? thesisQuickFormErrors : {},
            thesisSaving: thesisQuickFormCode === holding.code ? thesisSaving : false,
            onChangeThesisQuickForm: handleThesisQuickFormChange,
            onSaveThesisQuickForm: handleThesisQuickFormSave,
            onCancelThesisQuickForm: closeThesisQuickForm,
          })
        )
      )
    ),
    h(HoldingDetailPane, {
      open: Boolean(detailStockCode && detailDossier),
      detail: detailDossier,
      onClose: handleCloseDetail,
    })
  )
}
