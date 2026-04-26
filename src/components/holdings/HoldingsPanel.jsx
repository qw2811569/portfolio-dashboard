import { createElement as h, useState } from 'react'
import { A, C, alpha } from '../../theme.js'
import { IND_COLOR, STOCK_META } from '../../seedData.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'
import { useUpstreamHealth } from '../../hooks/useUpstreamHealth.js'
import {
  AccuracyGateBlock,
  Card,
  DataError,
  MarkdownText,
  OperatingContextCard,
  TextFieldDialog,
  UpstreamHealthBanner,
} from '../common'
import { getHoldingMarketValue, getHoldingReturnPct } from '../../lib/holdings.js'
import HoldingsRing from '../overview/HoldingsRing.jsx'

const lbl = {
  fontSize: 12,
  color: C.textMute,
  letterSpacing: '0.06em',
  fontWeight: 600,
  marginBottom: 4,
}
const metricCard = {
  background: C.raised,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: '8px 8px',
  boxShadow: `${C.insetLine}, ${C.shadow}`,
}

const trackedSyncTone = {
  fresh: {
    color: C.textSec,
    border: alpha(C.positive, '30'),
    background: alpha(C.positive, '10'),
  },
  stale: {
    color: C.textSec,
    border: alpha(C.amber, '30'),
    background: alpha(C.amber, '12'),
  },
  missing: {
    color: C.textMute,
    border: alpha(C.textMute, '24'),
    background: alpha(C.textMute, '10'),
  },
  failed: {
    color: C.down,
    border: alpha(C.down, '30'),
    background: alpha(C.down, '10'),
  },
}

/**
 * Holdings Summary Metrics
 */
export function HoldingsSummary({
  holdings,
  totalVal,
  totalCost,
  todayTotalPnl = 0,
  todayPnlHasPriceData = true,
  todayPnlIsStale = false,
  marketPriceSync = null,
}) {
  const showStalePlaceholder = Boolean(
    holdings.length > 0 &&
    (todayPnlIsStale ||
      !todayPnlHasPriceData ||
      todayTotalPnl == null ||
      (marketPriceSync?.status === 'failed' && Number(todayTotalPnl || 0) === 0))
  )
  const todayPnlColor = showStalePlaceholder
    ? C.textMute
    : todayTotalPnl > 0
      ? C.text
      : todayTotalPnl < 0
        ? C.down
        : C.textSec
  const todayPnlText = showStalePlaceholder
    ? '—'
    : todayTotalPnl > 0
      ? `+${todayTotalPnl.toLocaleString()}`
      : todayTotalPnl < 0
        ? todayTotalPnl.toLocaleString()
        : '0'

  const metrics = [
    ['總成本', totalCost.toLocaleString(), C.textSec],
    ['總市值', totalVal.toLocaleString(), C.text],
    ['持股數', `${holdings.length}檔`, C.lavender],
    ['今日損益', todayPnlText, todayPnlColor],
  ]

  return h(
    'div',
    {
      style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginBottom: 8 },
    },
    metrics.map(([label, value, color]) =>
      h(
        'div',
        { key: label, className: 'ui-card', style: metricCard },
        h('div', { style: { fontSize: 11, color: C.textMute, letterSpacing: '0.08em' } }, label),
        h(
          'div',
          {
            'data-testid': label === '今日損益' ? 'holdings-summary-today-pnl' : undefined,
            className: 'tn',
            style: {
              fontSize: 14,
              fontWeight: 600,
              color: label === '總市值' ? C.text : label === '持股數' ? C.textSec : color,
              marginTop: 4,
            },
          },
          value
        )
      )
    )
  )
}

/**
 * Holdings Integrity Warning
 */
export function HoldingsIntegrityWarning({ issues }) {
  if (!issues || issues.length === 0) return null

  return h(
    'div',
    {
      style: {
        ...metricCard,
        marginBottom: 8,
        borderLeft: `3px solid ${alpha(C.amber, '40')}`,
        padding: '8px 8px',
        fontSize: 12,
        color: C.textSec,
        lineHeight: 1.7,
      },
    },
    `有 ${issues.length} 檔現在抓不到價格，市值會先少一塊： `,
    issues
      .slice(0, 5)
      .map((item) => `${item.name || item.code}(${item.code})`)
      .join('、'),
    issues.length > 5 ? '…' : '',
    '。先按一次「收盤價」重抓；如果還在，就表示這幾檔要手動補資料。'
  )
}

function TrackedStocksSyncBadge({ badge = null, syncState = null, suppressErrorBanner = false }) {
  if (!badge && syncState?.status !== 'failed') return null

  const tone = trackedSyncTone[badge?.status] || trackedSyncTone.missing

  return h(
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
    syncState?.status === 'failed' &&
      !suppressErrorBanner &&
      h(DataError, {
        status: syncState?.errorStatus || 401,
        resource: 'tracked-stocks',
        retryBehavior: 'manual',
        onRetry: () => {
          if (typeof window !== 'undefined') window.location.reload()
        },
        style: { width: '100%' },
      }),
    badge &&
      h(
        'span',
        {
          'data-testid': 'tracked-stocks-sync-badge',
          title: badge.title,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            borderRadius: 8,
            padding: '4px 8px',
            fontSize: 12,
            lineHeight: 1.2,
            fontWeight: 700,
            letterSpacing: '0.01em',
            border: `1px solid ${tone.border}`,
            background: tone.background,
            color: tone.color,
          },
        },
        badge.label
      )
  )
}

function getHoldingTargetError(holdingDossiers = []) {
  return (Array.isArray(holdingDossiers) ? holdingDossiers : []).find(
    (dossier) => dossier?.targetFetchError?.status
  )?.targetFetchError
}

function toFilterTestIdSegment(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function renderChipButton({
  testId,
  label,
  count,
  active = false,
  tone = 'default',
  onClick = () => {},
}) {
  const toneMeta =
    tone === 'intent'
      ? {
          activeBorder: alpha(C.cta, '5a'),
          activeBackground: alpha(C.cta, '18'),
          activeColor: C.ink,
          idleBorder: alpha(C.cta, '22'),
          idleBackground: alpha(C.card, 'f6'),
          idleColor: C.text,
        }
      : {
          activeBorder: alpha(C.cta, A.strongLine),
          activeBackground: alpha(C.cta, '16'),
          activeColor: C.ink,
          idleBorder: alpha(C.charcoal, '26'),
          idleBackground: C.bone,
          idleColor: C.textSec,
        }

  return h(
    'button',
    {
      key: testId,
      type: 'button',
      'data-testid': testId,
      'aria-pressed': active,
      onClick,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 44,
        padding: '10px 14px',
        borderRadius: 8,
        border: `1px solid ${active ? toneMeta.activeBorder : toneMeta.idleBorder}`,
        background: active ? toneMeta.activeBackground : toneMeta.idleBackground,
        color: active ? toneMeta.activeColor : toneMeta.idleColor,
        fontSize: 12,
        lineHeight: 1.2,
        fontWeight: active ? 700 : 600,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        boxShadow: active ? `${C.insetLine}, 0 6px 14px ${alpha(C.cta, '10')}` : 'none',
        flexShrink: 0,
      },
    },
    h('span', null, label),
    typeof count === 'number' &&
      h(
        'span',
        {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 22,
            height: 22,
            padding: '0 6px',
            borderRadius: 8,
            background: active ? alpha(C.ink, '10') : alpha(C.charcoal, '10'),
            color: active ? C.ink : C.textSec,
            fontSize: 11,
            fontWeight: 700,
          },
        },
        count
      )
  )
}

function renderFilterGroupRow(group) {
  if (!group || !Array.isArray(group.chips) || group.chips.length === 0) return null

  return h(
    'div',
    {
      key: group.key,
      'data-testid': `holdings-filter-group-${group.key}`,
      style: {
        display: 'grid',
        gap: 6,
      },
    },
    h(
      'div',
      {
        style: {
          fontSize: 11,
          color: C.textMute,
          fontWeight: 700,
          letterSpacing: '0.08em',
        },
      },
      group.label
    ),
    h(
      'div',
      {
        style: {
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 4,
          scrollbarWidth: 'none',
        },
      },
      group.chips.map((chip) =>
        renderChipButton({
          testId: `holdings-filter-${group.key}-${toFilterTestIdSegment(chip.key)}`,
          label: chip.label,
          count: chip.count,
          active: chip.active,
          tone: 'secondary',
          onClick: chip.onClick,
        })
      )
    )
  )
}

function HoldingsFilterChipBar({ filterBar }) {
  const isMobile = useIsMobile()
  const [mobileAdvancedOpen, setMobileAdvancedOpen] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveError, setSaveError] = useState('')
  const safeFilterBar = filterBar && typeof filterBar === 'object' ? filterBar : null
  if (!safeFilterBar || safeFilterBar.totalCount === 0) return null

  const primaryChips = Array.isArray(safeFilterBar.primaryChips) ? safeFilterBar.primaryChips : []
  const filterGroups = Array.isArray(safeFilterBar.filterGroups) ? safeFilterBar.filterGroups : []
  const savedFilters = Array.isArray(safeFilterBar.savedFilters) ? safeFilterBar.savedFilters : []
  const activeFilterCount = Number(safeFilterBar.activeFilterCount) || 0
  const showAdvancedBody = !isMobile || mobileAdvancedOpen

  const handleSaveSubmit = () => {
    const result = safeFilterBar.onSaveCurrentFilter?.(saveName)
    if (!result?.ok) {
      setSaveError(result?.error || '暫時存不起來，先檢查條件。')
      return
    }
    setSaveDialogOpen(false)
    setSaveName('')
    setSaveError('')
  }

  const savedControls = h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        flexWrap: 'wrap',
        justifyContent: isMobile ? 'space-between' : 'flex-end',
        width: isMobile ? '100%' : 'auto',
      },
    },
    savedFilters.length > 0 &&
      h(
        'label',
        {
          style: {
            display: 'grid',
            gap: 4,
            fontSize: 11,
            color: C.textMute,
            minWidth: isMobile ? '100%' : 220,
            flex: isMobile ? '1 1 100%' : '0 1 220px',
          },
        },
        'Saved filter',
        h(
          'select',
          {
            'data-testid': 'holdings-filter-saved-select',
            value: safeFilterBar.activeSavedFilterId || '',
            onChange: (event) => safeFilterBar.onApplySavedFilter?.(event.target.value),
            style: {
              minHeight: 44,
              borderRadius: C.radii.md,
              border: `1px solid ${C.border}`,
              background: C.raised,
              color: C.text,
              padding: '0 12px',
              fontSize: 12,
              width: '100%',
            },
          },
          h('option', { value: '' }, '套用已存 filter'),
          savedFilters.map((item) => h('option', { key: item.id, value: item.id }, item.name))
        )
      ),
    h(
      'button',
      {
        type: 'button',
        'data-testid': 'holdings-filter-save',
        disabled: !safeFilterBar.canSaveCurrentFilter,
        onClick: () => {
          setSaveDialogOpen(true)
          setSaveName('')
          setSaveError('')
        },
        style: {
          minHeight: 44,
          padding: '10px 14px',
          borderRadius: 8,
          border: `1px solid ${alpha(C.cta, '32')}`,
          background: safeFilterBar.canSaveCurrentFilter ? alpha(C.cta, '14') : alpha(C.iron, '10'),
          color: safeFilterBar.canSaveCurrentFilter ? C.text : C.textMute,
          fontSize: 12,
          fontWeight: 700,
          cursor: safeFilterBar.canSaveCurrentFilter ? 'pointer' : 'not-allowed',
          whiteSpace: 'nowrap',
        },
      },
      '存 filter'
    )
  )

  const searchField = h(
    'label',
    {
      style: {
        display: 'grid',
        gap: 4,
        minWidth: 0,
        flex: '1 1 280px',
      },
    },
    h(
      'span',
      {
        style: {
          fontSize: 11,
          color: C.textMute,
          fontWeight: 700,
          letterSpacing: '0.08em',
        },
      },
      '搜尋 / Search'
    ),
    h('input', {
      'data-testid': 'holdings-filter-search',
      type: 'search',
      value: safeFilterBar.searchQuery || '',
      placeholder: '輸入 code / 股票名 / thesis 關鍵字，例如 2330、台積電、AI',
      onChange: (event) => safeFilterBar.onSearchChange?.(event.target.value),
      style: {
        minHeight: 44,
        width: '100%',
        borderRadius: C.radii.md,
        border: `1px solid ${C.border}`,
        background: C.raised,
        color: C.text,
        padding: '0 12px',
        fontSize: 13,
        boxSizing: 'border-box',
      },
    })
  )

  return h(
    'div',
    null,
    h(
      Card,
      {
        style: {
          marginBottom: 8,
          padding: '12px 12px 10px',
        },
      },
      h(
        'div',
        {
          'data-testid': 'holdings-filter-chip-bar',
          style: {
            display: 'grid',
            gap: 12,
          },
        },
        h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            },
          },
          searchField,
          savedControls
        ),
        h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
            },
          },
          h(
            'div',
            {
              style: {
                display: 'grid',
                gap: 4,
              },
            },
            h(
              'div',
              {
                style: {
                  fontSize: 12,
                  color: C.text,
                  fontWeight: 700,
                },
              },
              activeFilterCount > 0 || safeFilterBar.debouncedSearchQuery
                ? `可行動範圍 · ${safeFilterBar.filteredCount} / ${safeFilterBar.totalCount} 檔`
                : `全部先攤開 · ${safeFilterBar.totalCount} 檔`
            ),
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                  fontSize: 11,
                  color: C.textMute,
                },
              },
              activeFilterCount > 0 &&
                h(
                  'span',
                  {
                    'data-testid': 'holdings-filter-active-count',
                    style: {
                      display: 'inline-flex',
                      alignItems: 'center',
                      borderRadius: 8,
                      minHeight: 24,
                      padding: '0 8px',
                      background: alpha(C.cta, '16'),
                      color: C.ink,
                      fontWeight: 700,
                    },
                  },
                  `${activeFilterCount} 個條件`
                ),
              safeFilterBar.debouncedSearchQuery &&
                h(
                  'span',
                  {
                    style: {
                      display: 'inline-flex',
                      alignItems: 'center',
                      borderRadius: 8,
                      minHeight: 24,
                      padding: '0 8px',
                      background: alpha(C.iron, '10'),
                    },
                  },
                  `搜尋：${safeFilterBar.debouncedSearchQuery}`
                )
            )
          ),
          activeFilterCount > 0 &&
            h(
              'button',
              {
                type: 'button',
                'data-testid': 'holdings-filter-clear',
                onClick: safeFilterBar.onClearAll,
                style: {
                  minHeight: 44,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: `1px solid ${alpha(C.cta, A.strongLine)}`,
                  background: C.surface,
                  color: C.text,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                },
              },
              '清除所有篩選'
            )
        ),
        h(
          'div',
          {
            'data-testid': 'holdings-filter-primary-row',
            style: {
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              paddingBottom: 4,
              scrollbarWidth: 'none',
            },
          },
          primaryChips.map((chip) =>
            renderChipButton({
              testId: `holdings-filter-primary-${chip.key}`,
              label: chip.label,
              count: chip.count,
              active: chip.active,
              tone: 'intent',
              onClick: chip.onClick,
            })
          )
        ),
        isMobile &&
          filterGroups.some((group) => group.chips.length > 0) &&
          h(
            'button',
            {
              type: 'button',
              'data-testid': 'holdings-filter-mobile-toggle',
              'aria-expanded': showAdvancedBody,
              'aria-controls': 'holdings-filter-advanced-body',
              onClick: () => setMobileAdvancedOpen((open) => !open),
              style: {
                minHeight: 44,
                padding: '10px 14px',
                borderRadius: 8,
                border: `1px solid ${alpha(C.amber, '32')}`,
                background: alpha(C.amber, '10'),
                color: C.text,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                justifySelf: 'start',
              },
            },
            showAdvancedBody ? '收起進階篩選' : '展開進階篩選'
          ),
        showAdvancedBody &&
          h(
            'div',
            {
              id: 'holdings-filter-advanced-body',
              'data-testid': 'holdings-filter-advanced-body',
              style: {
                display: 'grid',
                gap: 12,
              },
            },
            filterGroups.map(renderFilterGroupRow)
          )
      )
    ),
    h(TextFieldDialog, {
      open: saveDialogOpen,
      title: '儲存 holdings filter',
      subtitle: '這裡只存主 / 副 chip 組合；搜尋字會另外處理。',
      label: 'filter 名稱',
      value: saveName,
      onChange: (event) => {
        setSaveName(event.target.value)
        if (saveError) setSaveError('')
      },
      onSubmit: handleSaveSubmit,
      onCancel: () => {
        setSaveDialogOpen(false)
        setSaveError('')
        setSaveName('')
      },
      submitLabel: '儲存',
      placeholder: '例：法說前先看 / 集中度檢查',
      submitDisabled: !safeFilterBar.canSaveCurrentFilter,
      error: saveError,
    })
  )
}

/**
 * Portfolio Health Check
 */
export function PortfolioHealthCheck({ holdings }) {
  if (!holdings || holdings.length === 0) return null

  // Industry distribution
  const indMap = {}
  holdings.forEach((h) => {
    const m = STOCK_META[h.code]
    if (!m) return
    indMap[m.industry] = (indMap[m.industry] || 0) + getHoldingMarketValue(h)
  })
  const indArr = Object.entries(indMap).sort((a, b) => b[1] - a[1])
  const indTotal = indArr.reduce((s, x) => s + x[1], 0) || 1

  // Strategy distribution
  const stratMap = {}
  holdings.forEach((h) => {
    const m = STOCK_META[h.code]
    if (!m) return
    stratMap[m.strategy] = (stratMap[m.strategy] || 0) + 1
  })

  // Period distribution
  const periodMap = {}
  holdings.forEach((h) => {
    const m = STOCK_META[h.code]
    if (!m) return
    periodMap[m.period] = (periodMap[m.period] || 0) + 1
  })

  // Position distribution
  const posMap = {}
  holdings.forEach((h) => {
    const m = STOCK_META[h.code]
    if (!m) return
    posMap[m.position] = (posMap[m.position] || 0) + getHoldingMarketValue(h)
  })

  // Industry concentration warnings
  const warnings = indArr.filter(([ind, val]) => {
    const count = holdings.filter((h) => STOCK_META[h.code]?.industry === ind).length
    return count >= 3 || val / indTotal > 0.25
  })

  return h(
    Card,
    { style: { marginBottom: 8 } },
    h('div', { style: lbl }, '投組健檢'),

    // Industry bar
    h(
      'div',
      {
        style: {
          display: 'flex',
          borderRadius: 4,
          overflow: 'hidden',
          height: 6,
          marginBottom: 8,
        },
      },
      indArr.map(([ind, val]) =>
        h('div', {
          key: ind,
          style: {
            width: `${(val / indTotal) * 100}%`,
            height: '100%',
            background: IND_COLOR[ind] || C.textMute,
          },
        })
      )
    ),

    // Industry labels
    h(
      'div',
      { style: { display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 } },
      indArr.map(([ind, val]) => {
        const pct = ((val / indTotal) * 100).toFixed(0)
        const count = holdings.filter((h) => STOCK_META[h.code]?.industry === ind).length
        const color = IND_COLOR[ind] || C.textMute
        return h(
          'span',
          {
            key: ind,
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 6,
              background: C.subtle,
              border: `1px solid ${C.border}`,
              color: C.textSec,
            },
          },
          h('span', {
            style: { width: 6, height: 6, borderRadius: 3, background: color, flexShrink: 0 },
          }),
          `${ind} ${count}檔 ${pct}%`
        )
      })
    ),

    // Warnings
    warnings.length > 0 &&
      h(
        'div',
        {
          style: {
            background: C.amberBg,
            border: `1px solid ${alpha(C.amber, '20')}`,
            borderRadius: 6,
            padding: '4px 8px',
            marginBottom: 8,
            fontSize: 12,
            color: C.textSec,
            lineHeight: 1.6,
          },
        },
        '產業集中：',
        warnings
          .map(([ind]) => {
            const count = holdings.filter((h) => STOCK_META[h.code]?.industry === ind).length
            return `${ind}(${count}檔)`
          })
          .join('、'),
        warnings.some(([, val]) => val / indTotal > 0.3) && ' — 建議分散風險'
      ),

    // Three column distributions
    h(
      'div',
      { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 } },
      h(
        'div',
        null,
        h('div', { style: { fontSize: 11, color: C.textMute, marginBottom: 4 } }, '策略框架'),
        Object.entries(stratMap)
          .sort((a, b) => b[1] - a[1])
          .map(([s, n]) =>
            h(
              'div',
              { key: s, style: { fontSize: 12, color: C.textSec, marginBottom: 4 } },
              s,
              ' ',
              h('span', { style: { color: C.text, fontWeight: 600 } }, n)
            )
          )
      ),
      h(
        'div',
        null,
        h('div', { style: { fontSize: 11, color: C.textMute, marginBottom: 4 } }, '持有週期'),
        Object.entries(periodMap).map(([p, n]) =>
          h(
            'div',
            { key: p, style: { fontSize: 12, color: C.textSec, marginBottom: 4 } },
            p === '短' ? '短期' : p === '中' ? '中期' : p === '短中' ? '短中期' : '中長期',
            ' ',
            h('span', { style: { color: C.text, fontWeight: 600 } }, n)
          )
        )
      ),
      h(
        'div',
        null,
        h('div', { style: { fontSize: 11, color: C.textMute, marginBottom: 4 } }, '持倉定位'),
        Object.entries(posMap)
          .sort((a, b) => b[1] - a[1])
          .map(([p, val]) =>
            h(
              'div',
              { key: p, style: { fontSize: 12, color: C.textSec, marginBottom: 4 } },
              p,
              ' ',
              h(
                'span',
                { style: { color: C.text, fontWeight: 600 } },
                `${((val / indTotal) * 100).toFixed(0)}%`
              )
            )
          )
      )
    )
  )
}

/**
 * Top 5 Holdings by Market Value
 */
export function Top5Holdings({ holdings, totalVal }) {
  const top5 = [...holdings]
    .sort((a, b) => getHoldingMarketValue(b) - getHoldingMarketValue(a))
    .slice(0, 5)

  if (top5.length === 0) return null

  return h(
    Card,
    { style: { marginBottom: 8 } },
    h('div', { style: lbl }, '市值佔比 Top 5'),
    h(
      'div',
      { style: { display: 'flex', gap: 4, flexWrap: 'wrap' } },
      top5.map((holding) => {
        const pct = (getHoldingMarketValue(holding) / Math.max(totalVal, 1)) * 100
        return h(
          'div',
          {
            key: holding.code,
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: C.subtle,
              border: `1px solid ${C.border}`,
              borderRadius: C.radii.lg,
              padding: '4px 8px',
            },
          },
          h('span', { style: { fontSize: 11, color: C.textSec, fontWeight: 500 } }, holding.name),
          h(
            'span',
            { style: { fontSize: 11, fontWeight: 700, color: C.text } },
            `${pct.toFixed(1)}%`
          )
        )
      })
    )
  )
}

/**
 * Winners and Losers Summary
 */
export function WinLossSummary({ winners, losers }) {
  return h(
    'div',
    { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 } },
    h(
      Card,
      {
        style: {
          borderLeft: `3px solid ${alpha(C.up, '40')}`,
          padding: '8px 8px',
        },
      },
      h(
        'div',
        { style: { ...lbl, color: C.textSec, marginBottom: 4 } },
        `獲利 ${winners.length}檔`
      ),
      winners.slice(0, 3).map((holding) =>
        h(
          'div',
          {
            key: holding.code,
            style: { display: 'flex', justifyContent: 'space-between', marginTop: 4 },
          },
          h('span', { style: { fontSize: 11, color: C.textSec } }, holding.name),
          h(
            'span',
            { style: { fontSize: 11, fontWeight: 600, color: C.text } },
            `+${getHoldingReturnPct(holding).toFixed(2)}%`
          )
        )
      )
    ),
    h(
      Card,
      {
        style: {
          borderLeft: `3px solid ${alpha(C.down, '40')}`,
          padding: '8px 8px',
        },
      },
      h('div', { style: { ...lbl, color: C.down, marginBottom: 4 } }, `虧損 ${losers.length}檔`),
      losers.slice(0, 3).map((holding) =>
        h(
          'div',
          {
            key: holding.code,
            style: { display: 'flex', justifyContent: 'space-between', marginTop: 4 },
          },
          h('span', { style: { fontSize: 11, color: C.textSec } }, holding.name),
          h(
            'span',
            { style: { fontSize: 11, fontWeight: 600, color: C.down } },
            `${getHoldingReturnPct(holding).toFixed(2)}%`
          )
        )
      )
    )
  )
}

/**
 * Daily Insight Card — 今日收盤快評摘要
 */
function DailyInsightCard({ latestInsight }) {
  if (!latestInsight) return null
  // 取第一段（到第一個 ## 或 --- 為止）作為摘要
  const full = String(latestInsight || '')
  const firstBreak = full.search(/\n#{1,3}\s|\n---/)
  const summary = firstBreak > 0 ? full.slice(0, firstBreak).trim() : full.slice(0, 200).trim()
  if (!summary) return null

  return h(
    Card,
    { style: { marginBottom: 8, borderLeft: `3px solid ${C.accent}` } },
    h(
      'div',
      {
        style: {
          fontSize: 12,
          color: C.textMute,
          marginBottom: 4,
          letterSpacing: '0.06em',
          fontWeight: 600,
        },
      },
      'AI 今日快評'
    ),
    h(MarkdownText, { text: summary, color: C.textSec })
  )
}

/**
 * Main Holdings Panel Component
 */
export function HoldingsPanel({
  activePortfolioId = '',
  holdings = [],
  holdingDossiers = [],
  totalVal = 0,
  totalCost = 0,
  todayTotalPnl = 0,
  todayPnlHasPriceData = true,
  todayPnlIsStale = false,
  winners = [],
  losers = [],
  top5: _top5 = [],
  holdingsIntegrityIssues = [],
  showReversal: _showReversal = false,
  setShowReversal: _setShowReversal = () => {},
  reversalConditions: _reversalConditions = {},
  latestInsight = null,
  operatingContext = null,
  reportRefreshMeta = {},
  marketPriceSync = null,
  holdingsFilterBar = null,
  children,
}) {
  const targetFetchError = getHoldingTargetError(holdingDossiers)
  const upstreamHealth = useUpstreamHealth({
    panel: 'holdings',
    activePortfolioId,
    holdingDossiers,
    marketPriceSync,
    reportRefreshMeta,
  })
  const holdingsAccuracyGate = upstreamHealth.accuracyGate
  const handleRetryAll = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  return h(
    'div',
    { 'data-testid': 'holdings-panel' },
    h(OperatingContextCard, { context: operatingContext, variant: 'home' }),
    h(UpstreamHealthBanner, {
      banner: upstreamHealth.banner,
      onRetryAll: handleRetryAll,
    }),
    !upstreamHealth.shouldCollapseBanners &&
      holdingsAccuracyGate &&
      h(AccuracyGateBlock, {
        reason: holdingsAccuracyGate.reason,
        resource: holdingsAccuracyGate.resource,
        context: holdingsAccuracyGate.context,
        onRetry: () => {
          if (typeof window !== 'undefined') window.location.reload()
        },
      }),
    !upstreamHealth.shouldCollapseBanners &&
      targetFetchError &&
      h(DataError, {
        status: targetFetchError.status,
        resource: 'target-prices',
        retryBehavior: 'manual',
        onRetry: () => {
          if (typeof window !== 'undefined') window.location.reload()
        },
        style: { marginBottom: 8 },
      }),
    h(
      'div',
      {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 8,
          alignItems: 'start',
          marginBottom: 8,
        },
      },
      h(
        'div',
        { style: { minWidth: 0 } },
        // Summary metrics
        h(HoldingsSummary, {
          holdings,
          totalVal,
          totalCost,
          todayTotalPnl,
          todayPnlHasPriceData,
          todayPnlIsStale,
          marketPriceSync,
        }),
        h(TrackedStocksSyncBadge, {
          badge: upstreamHealth.badge,
          syncState: upstreamHealth.syncState,
          suppressErrorBanner: upstreamHealth.shouldCollapseBanners,
        })
      ),
      h(
        Card,
        {
          style: {
            padding: '16px 16px 12px',
          },
        },
        h(HoldingsRing, { holdings, totalVal, stockMeta: STOCK_META, holdingDossiers })
      )
    ),

    // Filter chip bar
    h(HoldingsFilterChipBar, { filterBar: holdingsFilterBar }),

    // Daily insight card
    h(DailyInsightCard, { latestInsight }),

    // Integrity warning
    h(HoldingsIntegrityWarning, { issues: holdingsIntegrityIssues }),

    // Portfolio health check
    h(PortfolioHealthCheck, { holdings }),

    // Top 5
    h(Top5Holdings, { holdings, totalVal }),

    // Win/Loss summary
    h(WinLossSummary, { winners, losers }),

    // Children (additional content like holdings table)
    children
  )
}
