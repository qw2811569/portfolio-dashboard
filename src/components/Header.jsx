import { createElement as h, useState } from 'react'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { displayPortfolioName } from '../lib/portfolioDisplay.js'
import { C, A, alpha } from '../theme.js'
import { ConfirmDialog, TextFieldDialog } from './common/index.js'
import { useOverlay, useOverlayBlockingStyle } from './common/AppOverlay.jsx'

export const COMPACT_LANDSCAPE_MEDIA_QUERY = '(max-height: 500px) and (orientation: landscape)'

export default function Header(props) {
  const {
    cloudSync,
    saved,
    refreshPrices,
    refreshing,
    copyWeeklyReport,
    downloadWeeklyReportMarkdown,
    downloadWeeklyReportPdf,
    exportLocalBackup,
    importLocalBackup,
    onOpenOnboarding,
    priceSyncStatusTone,
    priceSyncStatusLabel,
    activePriceSyncAt,
    lastUpdate,
    pc,
    displayedTotalPnl,
    displayedRetPct,
    activePortfolioId,
    switchPortfolio,
    ready,
    portfolioSwitching,
    portfolioSummaries,
    createPortfolio,
    viewMode,
    exitOverview,
    openOverview,
    showPortfolioManager,
    setShowPortfolioManager,
    renamePortfolio,
    deletePortfolio,
    OWNER_PORTFOLIO_ID,
    overviewTotalValue,
    portfolioNotes,
    setPortfolioNotes,
    PORTFOLIO_VIEW_MODE,
    OVERVIEW_VIEW_MODE,
    urgentCount,
    todayAlertSummary,
    TABS,
    tab,
    setTab,
    workflowCue,
    portfolioEditor,
    portfolioDeleteDialog,
  } = props
  const backupInputId = 'header-backup-file-input'
  const tabs = Array.isArray(TABS) ? TABS : []
  const safePortfolioSummaries = Array.isArray(portfolioSummaries) ? portfolioSummaries : []
  const editor = portfolioEditor || null
  const deleteDialog = portfolioDeleteDialog || null
  const [isNoticeOpen, setIsNoticeOpen] = useState(false)
  const [isMobileActionsOpen, setIsMobileActionsOpen] = useState(false)
  const [isMobileTabsOpen, setIsMobileTabsOpen] = useState(false)
  const [hoveredTab, setHoveredTab] = useState('')
  const isMobile = useIsMobile()
  const isCompactLandscape = useIsMobile(COMPACT_LANDSCAPE_MEDIA_QUERY)
  const { isBlocking: isOverlayBlocking } = useOverlay()
  const overlayBlockingStyle = useOverlayBlockingStyle()
  const activePortfolioSummary =
    safePortfolioSummaries.find((portfolio) => portfolio.id === activePortfolioId) || null
  const activePortfolioLabel = displayPortfolioName(
    activePortfolioSummary || { id: activePortfolioId }
  )
  const navigateToTab = (nextTab) => {
    if (!nextTab) return
    if (nextTab === 'overview' && typeof openOverview === 'function') {
      openOverview()
    } else if (typeof setTab === 'function') {
      setTab(nextTab)
    } else {
      return
    }
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
  const handleTabSelect = (nextTab) => {
    navigateToTab(nextTab)
    setIsMobileTabsOpen(false)
  }
  const mobilePrimaryTabKeys = ['dashboard', 'holdings', 'events', 'daily', 'research']
  const mobileOverflowTabKeys = ['news', 'trade', 'log']
  const normalizeMobileLabel = (tabItem) => {
    const labels = {
      dashboard: '看板',
      holdings: '持倉',
      events: '事件',
      daily: '收盤',
      research: '深度',
      news: 'News',
      trade: 'Trade',
      log: 'Log',
    }
    return labels[tabItem?.k] || tabItem?.label || ''
  }

  const ghostBtn = {
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 500,
    minHeight: 44,
    minWidth: 44,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition:
      'background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease',
  }
  const card = {
    background: alpha(C.raised, 'f8'),
    border: `1px solid ${C.border}`,
    borderRadius: 12,
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
  const shellSurface = {
    background: alpha(C.raised, 'f4'),
    boxShadow: C.shellShadow,
  }
  const hasHeaderNotice = viewMode !== OVERVIEW_VIEW_MODE && workflowCue?.kind === 'data-refresh'
  const noticeItems = Array.isArray(workflowCue?.items) ? workflowCue.items : []
  const cloudIndicator = h(
    'span',
    { style: { color: C.textSec, fontSize: isCompactLandscape ? 10 : 11 } },
    cloudSync ? '雲端' : '本機'
  )
  const titleText = h(
    'span',
    {
      style: {
        fontSize: isCompactLandscape ? 17 : 20,
        fontWeight: 700,
        color: C.text,
        fontFamily: 'var(--font-headline)',
        letterSpacing: '0.01em',
      },
    },
    '持倉看板'
  )
  // R156 #7 · insider portfolio (例 7865 金聯成) · header 加 persistent
  // 「👑 公司代表」badge · 跨 tab contract · 不只 Daily 才看到合規模式
  const isInsiderView = viewMode === 'insider-compressed'
  const insiderBadge =
    isInsiderView &&
    h(
      'span',
      {
        'data-testid': 'header-insider-badge',
        title: 'Insider 公司代表合規模式 · 不出 AI 買賣建議 · 只列風險 / 狀態 / 合規邊界',
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          fontWeight: 600,
          color: C.text,
          padding: '3px 8px',
          borderRadius: 8,
          background: alpha(C.ink, '10'),
          border: `1px solid ${alpha(C.ink, '24')}`,
          whiteSpace: 'nowrap',
        },
      },
      '👑 公司代表'
    )
  const savedLabel =
    saved && h('span', { style: { color: C.textSec, fontSize: 11, fontWeight: 500 } }, saved)
  const refreshPricesButton = h(
    'button',
    {
      className: 'ui-btn',
      onClick: refreshPrices,
      disabled: refreshing,
      style: {
        background: refreshing ? C.subtle : alpha(C.ink, '10'),
        color: refreshing ? C.textMute : C.textSec,
        border: `1px solid ${refreshing ? C.border : alpha(C.ink, A.strongLine)}`,
        ...ghostBtn,
        cursor: refreshing ? 'not-allowed' : 'pointer',
      },
    },
    refreshing ? '股價更新中...' : '更新收盤價'
  )
  const weeklyReportButtonStyle = {
    color: C.textSec,
    ...ghostBtn,
  }
  const weeklyReportControls = h(
    'div',
    {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
      },
    },
    h(
      'button',
      {
        type: 'button',
        className: 'ui-btn',
        'data-testid': 'weekly-export-copy',
        onClick: copyWeeklyReport,
        style: {
          background: alpha(C.ink, '08'),
          border: `1px solid ${alpha(C.ink, A.strongLine)}`,
          ...weeklyReportButtonStyle,
        },
      },
      '複製'
    ),
    typeof downloadWeeklyReportMarkdown === 'function'
      ? h(
          'button',
          {
            type: 'button',
            className: 'ui-btn',
            'data-testid': 'weekly-export-md',
            onClick: downloadWeeklyReportMarkdown,
            style: {
              background: alpha(C.up, '10'),
              border: `1px solid ${alpha(C.up, A.strongLine)}`,
              ...weeklyReportButtonStyle,
            },
          },
          '下載 .md'
        )
      : null,
    typeof downloadWeeklyReportPdf === 'function'
      ? h(
          'button',
          {
            type: 'button',
            className: 'ui-btn',
            'data-testid': 'weekly-export-pdf',
            onClick: downloadWeeklyReportPdf,
            style: {
              background: alpha(C.fillTeal, '10'),
              border: `1px solid ${alpha(C.fillTeal, A.strongLine)}`,
              ...weeklyReportButtonStyle,
            },
          },
          '下載 .pdf'
        )
      : null
  )
  const onboardingHelpButton =
    typeof onOpenOnboarding === 'function'
      ? h(
          'button',
          {
            type: 'button',
            className: 'ui-btn',
            'data-testid': 'onboarding-help',
            onClick: onOpenOnboarding,
            style: {
              background: alpha(C.ink, '08'),
              color: C.textSec,
              border: `1px solid ${alpha(C.ink, A.strongLine)}`,
              ...ghostBtn,
            },
            'aria-label': '重看導覽',
          },
          '重看導覽'
        )
      : null
  const exportBackupButton = h(
    'button',
    {
      className: 'ui-btn',
      onClick: exportLocalBackup,
      style: {
        background: alpha(C.iron, '12'),
        color: C.textSec,
        border: `1px solid ${alpha(C.iron, A.strongLine)}`,
        ...ghostBtn,
      },
    },
    '備份'
  )
  const importBackupLabel = h(
    'label',
    {
      htmlFor: backupInputId,
      className: 'ui-btn',
      style: {
        background: C.subtle,
        color: C.textSec,
        border: `1px solid ${C.border}`,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        ...ghostBtn,
      },
    },
    '匯入'
  )
  const backupImportInput = h('input', {
    id: backupInputId,
    type: 'file',
    accept: 'application/json,.json',
    onChange: importLocalBackup,
    style: { display: 'none' },
  })
  const priceSyncMeta = h(
    'span',
    { style: { fontSize: 11, color: priceSyncStatusTone, fontWeight: 600 } },
    priceSyncStatusLabel,
    activePriceSyncAt
      ? ` · ${activePriceSyncAt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`
      : ''
  )
  const lastUpdateMeta =
    lastUpdate &&
    !refreshing &&
    h(
      'span',
      { style: { fontSize: 11, color: C.textMute } },
      `更新 ${lastUpdate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`
    )
  const headerNoticeControl =
    hasHeaderNotice &&
    h(
      'div',
      { style: { position: 'relative' } },
      h(
        'button',
        {
          type: 'button',
          className: 'ui-btn',
          'data-testid': 'header-notice-toggle',
          'aria-label': workflowCue.label || '查看資料補齊提醒',
          onClick: () => setIsNoticeOpen((open) => !open),
          style: {
            ...ghostBtn,
            padding: '8px 12px',
            border: `1px solid ${alpha(C.amber, '26')}`,
            background: alpha(C.amber, '10'),
            color: C.textSec,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          },
          title: workflowCue.reason || workflowCue.label || '',
        },
        h('span', { style: { fontSize: 12, fontWeight: 700 } }, '提醒'),
        h(
          'span',
          {
            style: {
              fontSize: 12,
              fontWeight: 700,
              minWidth: 18,
              textAlign: 'center',
              borderRadius: 8,
              padding: '4px 8px',
              background: alpha(C.amber, '18'),
              border: `1px solid ${alpha(C.amber, '24')}`,
              color: C.text,
            },
          },
          `${workflowCue.count || noticeItems.length || 0}`
        )
      ),
      isNoticeOpen &&
        h(
          'div',
          {
            'data-testid': 'header-notice-drawer',
            style: {
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 'min(340px, calc(100vw - 28px))',
              ...card,
              padding: '12px 12px 8px',
              zIndex: 12,
            },
          },
          h(
            'div',
            {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
              },
            },
            h(
              'div',
              { style: { fontSize: 11, fontWeight: 700, color: C.textSec } },
              '資料補齊提醒'
            ),
            h(
              'span',
              {
                style: {
                  fontSize: 11,
                  color: C.textMute,
                  borderRadius: 8,
                  padding: '4px 8px',
                  background: C.subtle,
                  border: `1px solid ${C.border}`,
                },
              },
              workflowCue.label || ''
            )
          ),
          workflowCue.reason &&
            h(
              'div',
              {
                style: {
                  fontSize: 12,
                  color: C.textSec,
                  lineHeight: 1.7,
                  marginBottom: 8,
                },
              },
              workflowCue.reason
            ),
          noticeItems.length > 0 &&
            h(
              'div',
              { style: { display: 'grid', gap: 4, marginBottom: 8 } },
              noticeItems.map((item) =>
                h(
                  'div',
                  {
                    key: `${item.code}-${item.name}`,
                    style: {
                      borderRadius: C.radii.md,
                      border: `1px solid ${C.borderSub}`,
                      background: C.subtle,
                      padding: '8px 8px',
                    },
                  },
                  h(
                    'div',
                    {
                      style: {
                        fontSize: 11,
                        color: C.text,
                        fontWeight: 600,
                        marginBottom: 4,
                      },
                    },
                    `${item.name} (${item.code})`
                  ),
                  h(
                    'div',
                    { style: { fontSize: 12, color: C.textSec, lineHeight: 1.6 } },
                    item.targetLabel || item.classificationNote || '尚未取得目標價'
                  )
                )
              )
            ),
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
            typeof workflowCue.onRefresh === 'function' &&
              h(
                'button',
                {
                  type: 'button',
                  className: 'ui-btn',
                  onClick: () => {
                    workflowCue.onRefresh()
                    setIsNoticeOpen(false)
                  },
                  style: {
                    ...ghostBtn,
                    background: C.subtle,
                    color: C.textSec,
                    border: `1px solid ${C.border}`,
                  },
                },
                '重新整理'
              ),
            workflowCue.targetTab &&
              h(
                'button',
                {
                  type: 'button',
                  className: 'ui-btn',
                  onClick: () => {
                    navigateToTab(workflowCue.targetTab)
                    setIsNoticeOpen(false)
                  },
                  style: {
                    ...ghostBtn,
                    background: alpha(C.ink, '10'),
                    color: C.textSec,
                    border: `1px solid ${alpha(C.ink, A.strongLine)}`,
                  },
                },
                workflowCue.actionLabel || '查看詳情'
              )
          )
        )
    )
  const pnlSummary = h(
    'div',
    { className: 'tn', style: { textAlign: 'right' } },
    h(
      'div',
      {
        style: {
          fontSize: 20,
          fontWeight: 700,
          color: displayedTotalPnl >= 0 ? C.text : pc(displayedTotalPnl),
          fontFamily: 'var(--font-num)',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        },
      },
      `${displayedTotalPnl >= 0 ? '+' : ''}${Math.round(displayedTotalPnl).toLocaleString()}`
    ),
    h(
      'div',
      {
        style: {
          fontSize: 12,
          fontWeight: 600,
          color: displayedRetPct >= 0 ? C.textSec : pc(displayedRetPct),
          fontFamily: 'var(--font-num)',
        },
      },
      `${displayedRetPct >= 0 ? '+' : ''}${displayedRetPct.toFixed(2)}%`
    )
  )
  const mobileTitleRow = h(
    'div',
    {
      'data-testid': 'header-mobile-title-row',
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
        height: isCompactLandscape ? 48 : 55,
        minHeight: isCompactLandscape ? 48 : 55,
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flex: 1,
          minWidth: 0,
          flexWrap: 'nowrap',
        },
      },
      titleText,
      insiderBadge || null,
      h(
        'span',
        {
          'data-testid': 'header-mobile-active-portfolio',
          title: activePortfolioLabel,
          style: {
            minWidth: 0,
            maxWidth: '42vw',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: C.subtle,
            padding: '5px 8px',
            fontSize: 11,
            fontWeight: 600,
            color: C.textSec,
          },
        },
        viewMode === OVERVIEW_VIEW_MODE ? '全部總覽' : activePortfolioLabel
      )
    ),
    h(
      'button',
      {
        type: 'button',
        className: 'ui-btn',
        'data-testid': 'header-mobile-overflow-toggle',
        'aria-label': '開啟更多操作',
        'aria-expanded': isMobileActionsOpen,
        'aria-controls': 'header-mobile-actions-drawer',
        onClick: () => setIsMobileActionsOpen((open) => !open),
        style: {
          ...ghostBtn,
          minWidth: 44,
          minHeight: 44,
          padding: '8px 10px',
          background: isMobileActionsOpen ? alpha(C.ink, '10') : C.subtle,
          color: C.textSec,
          border: `1px solid ${isMobileActionsOpen ? alpha(C.ink, A.strongLine) : C.border}`,
          fontSize: 18,
          lineHeight: 1,
        },
      },
      '⋯'
    )
  )
  const renderTabButton = (tabItem, { compact = false, fill = false, mobileBottom = false } = {}) =>
    h(
      'button',
      {
        className: 'ui-btn',
        key: tabItem.k,
        'data-testid': `tab-${tabItem.k}`,
        tabIndex: mobileBottom && isOverlayBlocking ? -1 : undefined,
        onClick: () => handleTabSelect(tabItem.k),
        onMouseEnter: () => setHoveredTab(tabItem.k),
        onMouseLeave: () => setHoveredTab((current) => (current === tabItem.k ? '' : current)),
        onFocus: () => setHoveredTab(tabItem.k),
        onBlur: () => setHoveredTab((current) => (current === tabItem.k ? '' : current)),
        style: {
          background:
            hoveredTab === tabItem.k && tab !== tabItem.k ? alpha(C.charcoal, '06') : 'transparent',
          color: tab === tabItem.k ? C.text : C.iron,
          border: 'none',
          borderBottom: tab === tabItem.k ? `2px solid ${C.cta}` : '2px solid transparent',
          boxShadow: 'none',
          minHeight: mobileBottom ? 50 : compact && isCompactLandscape ? 32 : 44,
          minWidth: mobileBottom ? 0 : compact ? (isCompactLandscape ? 38 : 44) : undefined,
          padding: mobileBottom
            ? '6px 4px'
            : compact
              ? isCompactLandscape
                ? '4px 10px'
                : '8px 10px'
              : '8px 12px',
          fontSize: compact ? 10 : 11,
          fontWeight: tab === tabItem.k ? 700 : 500,
          lineHeight: compact && isCompactLandscape ? 1 : undefined,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flex: fill ? '1 1 auto' : '0 0 auto',
          justifyContent: 'center',
          transition: 'background-color 200ms ease, color 200ms ease, border-color 200ms ease',
        },
      },
      mobileBottom
        ? h(
            'span',
            {
              style: {
                display: 'grid',
                gap: 2,
                justifyItems: 'center',
                alignItems: 'center',
              },
            },
            h('span', {
              'aria-hidden': 'true',
              style: {
                width: 15,
                height: 15,
                borderRadius: 4,
                boxSizing: 'border-box',
                background: tab === tabItem.k ? C.cta : 'transparent',
                border: `1.5px solid ${tab === tabItem.k ? C.cta : C.iron}`,
                boxShadow: tab === tabItem.k ? `inset 0 0 0 3px ${alpha(C.shell, 'd8')}` : 'none',
              },
            }),
            h('span', null, normalizeMobileLabel(tabItem))
          )
        : tabItem.label
    )
  const visibleMobileTabs = isMobile
    ? mobilePrimaryTabKeys.map((key) => tabs.find((item) => item.k === key)).filter(Boolean)
    : tabs
  const hiddenMobileTabs = isMobile
    ? mobileOverflowTabKeys.map((key) => tabs.find((item) => item.k === key)).filter(Boolean)
    : []
  const portfolioSelectorBlock = h(
    'div',
    {
      style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
    },
    h(
      'label',
      {
        htmlFor: 'header-portfolio-select',
        style: { fontSize: 11, color: C.textMute, fontWeight: 600, letterSpacing: '0.05em' },
      },
      '目前組合'
    ),
    h(
      'select',
      {
        id: 'header-portfolio-select',
        'data-testid': 'portfolio-select',
        'aria-label': '切換目前組合',
        value: activePortfolioId,
        onChange: (e) => switchPortfolio(e.target.value),
        disabled: !ready || portfolioSwitching,
        style: {
          minWidth: 190,
          height: 44,
          background: C.subtle,
          color: C.text,
          border: `1px solid ${C.border}`,
          borderRadius: C.radii.md,
          minHeight: 44,
          padding: '8px 12px',
          fontSize: 11,
          lineHeight: '20px',
          boxSizing: 'border-box',
          WebkitAppearance: 'none',
          cursor: portfolioSwitching ? 'progress' : 'pointer',
        },
      },
      safePortfolioSummaries.map((portfolio) =>
        h(
          'option',
          { key: portfolio.id, value: portfolio.id },
          `${displayPortfolioName(portfolio)} · ${portfolio.holdingCount}檔 · ${portfolio.retPct >= 0 ? '+' : ''}${portfolio.retPct.toFixed(1)}%`
        )
      )
    ),
    h(
      'button',
      {
        className: 'ui-btn',
        onClick: editor?.openCreate || createPortfolio,
        disabled: !ready || portfolioSwitching,
        style: {
          background: alpha(C.cta, '12'),
          color: C.textSec,
          border: `1px solid ${alpha(C.cta, A.strongLine)}`,
          ...ghostBtn,
          cursor: !ready || portfolioSwitching ? 'not-allowed' : 'pointer',
        },
      },
      portfolioSwitching ? '切換中...' : '＋ 新組合'
    ),
    h(
      'button',
      {
        className: 'ui-btn',
        onClick: viewMode === OVERVIEW_VIEW_MODE ? exitOverview : openOverview,
        disabled: !ready || portfolioSwitching,
        style: {
          background: viewMode === OVERVIEW_VIEW_MODE ? alpha(C.ink, '10') : alpha(C.ink, '08'),
          color: C.textSec,
          border: `1px solid ${viewMode === OVERVIEW_VIEW_MODE ? alpha(C.ink, A.strongLine) : alpha(C.ink, '20')}`,
          ...ghostBtn,
          cursor: !ready || portfolioSwitching ? 'not-allowed' : 'pointer',
        },
      },
      viewMode === OVERVIEW_VIEW_MODE ? '返回組合' : '全部總覽'
    ),
    h(
      'button',
      {
        className: 'ui-btn',
        onClick: () => setShowPortfolioManager((prev) => !prev),
        style: {
          background: showPortfolioManager ? C.subtleElev : C.subtle,
          color: C.textSec,
          border: `1px solid ${showPortfolioManager ? C.borderStrong : C.border}`,
          ...ghostBtn,
        },
      },
      showPortfolioManager ? '收合管理' : '管理組合'
    ),
    activePortfolioId &&
      h(
        'span',
        {
          'data-testid': 'portfolio-context-label',
          style: { fontSize: 12, color: C.textSec },
        },
        viewMode === OVERVIEW_VIEW_MODE
          ? `全部總覽 · ${safePortfolioSummaries.length} 組合 · 總市值 ${Math.round(overviewTotalValue).toLocaleString()}`
          : `${activePortfolioLabel} · ${activePortfolioSummary?.holdingCount || 0} 檔 · 損益 ${activePortfolioSummary?.totalPnl >= 0 ? '+' : ''}${Math.round(activePortfolioSummary?.totalPnl || 0).toLocaleString()}`
      )
  )
  const portfolioManagerBlock =
    showPortfolioManager &&
    h(
      'div',
      {
        style: {
          ...card,
          marginBottom: 8,
          borderLeft: `3px solid ${C.iron}`,
          boxShadow: `${C.insetLine}, ${C.shadow}, 0 0 0 1px ${alpha(C.iron, '10')}`,
        },
      },
      h(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
            flexWrap: 'wrap',
          },
        },
        h(
          'div',
          null,
          h('div', { style: { ...lbl, color: C.textSec, marginBottom: 4 } }, '組合管理'),
          h(
            'div',
            { style: { fontSize: 11, color: C.textSec } },
            '可以改名、刪除組合，並編輯目前組合的偏好備註。'
          )
        ),
        h(
          'span',
          { style: { fontSize: 11, color: C.textMute } },
          '總覽模式唯讀；切回單一組合才會寫入 notes。'
        )
      ),
      h(
        'div',
        { style: { display: 'grid', gap: 8 } },
        safePortfolioSummaries.map((portfolio) =>
          h(
            'div',
            {
              key: portfolio.id,
              style: {
                background: portfolio.id === activePortfolioId ? alpha(C.ink, '08') : C.subtle,
                border: `1px solid ${portfolio.id === activePortfolioId ? C.borderStrong : C.border}`,
                borderRadius: 8,
                padding: '8px 12px',
              },
            },
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 8,
                  flexWrap: 'wrap',
                },
              },
              h(
                'div',
                null,
                h(
                  'div',
                  { style: { fontSize: 12, color: C.text, fontWeight: 600 } },
                  displayPortfolioName(portfolio),
                  portfolio.id === OWNER_PORTFOLIO_ID &&
                    h(
                      'span',
                      { style: { fontSize: 11, color: C.textMute, marginLeft: 4 } },
                      '本人'
                    ),
                  portfolio.id === activePortfolioId &&
                    h('span', { style: { fontSize: 11, color: C.textSec, marginLeft: 4 } }, '目前')
                ),
                h(
                  'div',
                  { style: { fontSize: 12, color: C.textMute, marginTop: 4 } },
                  `${portfolio.holdingCount} 檔 · 近期事件 ${portfolio.pendingEvents?.length || 0} 件 · 報酬 ${portfolio.retPct >= 0 ? '+' : ''}${portfolio.retPct.toFixed(1)}%`
                )
              ),
              h(
                'div',
                { style: { display: 'flex', gap: 4, flexWrap: 'wrap' } },
                (portfolio.id !== activePortfolioId || viewMode === OVERVIEW_VIEW_MODE) &&
                  h(
                    'button',
                    {
                      className: 'ui-btn',
                      onClick: () => switchPortfolio(portfolio.id),
                      style: {
                        background: alpha(C.ink, '10'),
                        color: C.textSec,
                        border: `1px solid ${alpha(C.ink, A.strongLine)}`,
                        ...ghostBtn,
                      },
                    },
                    '打開這組'
                  ),
                h(
                  'button',
                  {
                    className: 'ui-btn',
                    onClick: () =>
                      editor?.openRename
                        ? editor.openRename(portfolio)
                        : renamePortfolio(portfolio.id),
                    style: {
                      background: alpha(C.amber, '10'),
                      color: C.textSec,
                      border: `1px solid ${alpha(C.amber, A.strongLine)}`,
                      ...ghostBtn,
                    },
                  },
                  '改名'
                ),
                portfolio.id !== OWNER_PORTFOLIO_ID &&
                  h(
                    'button',
                    {
                      className: 'ui-btn',
                      onClick: () =>
                        deleteDialog?.open
                          ? deleteDialog.open(portfolio)
                          : deletePortfolio(portfolio.id),
                      style: {
                        background: C.downBg,
                        color: C.down,
                        border: `1px solid ${alpha(C.down, A.strongLine)}`,
                        ...ghostBtn,
                      },
                    },
                    '刪除'
                  )
              )
            )
          )
        )
      ),
      viewMode === PORTFOLIO_VIEW_MODE
        ? h(
            'div',
            { style: { marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.borderSub}` } },
            h('div', { style: { ...lbl, marginBottom: 8 } }, '目前組合備註'),
            h(
              'div',
              {
                style: {
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  marginBottom: 8,
                },
              },
              h(
                'div',
                null,
                h(
                  'div',
                  { style: { fontSize: 11, color: C.textMute, marginBottom: 4 } },
                  '風險屬性'
                ),
                h('input', {
                  value: portfolioNotes?.riskProfile || '',
                  onChange: (e) =>
                    setPortfolioNotes((prev) => ({ ...prev, riskProfile: e.target.value })),
                  placeholder: '如：保守、波段、可接受回撤',
                  style: {
                    width: '100%',
                    background: C.subtle,
                    border: `1px solid ${C.border}`,
                    borderRadius: 7,
                    padding: '8px 8px',
                    color: C.text,
                    fontSize: 11,
                    fontFamily: 'inherit',
                  },
                })
              ),
              h(
                'div',
                null,
                h(
                  'div',
                  { style: { fontSize: 11, color: C.textMute, marginBottom: 4 } },
                  '操作偏好'
                ),
                h('input', {
                  value: portfolioNotes?.preferences || '',
                  onChange: (e) =>
                    setPortfolioNotes((prev) => ({ ...prev, preferences: e.target.value })),
                  placeholder: '如：只做財報前布局、避免權證',
                  style: {
                    width: '100%',
                    background: C.subtle,
                    border: `1px solid ${C.border}`,
                    borderRadius: 7,
                    padding: '8px 8px',
                    color: C.text,
                    fontSize: 11,
                    fontFamily: 'inherit',
                  },
                })
              )
            ),
            h(
              'div',
              null,
              h('div', { style: { fontSize: 11, color: C.textMute, marginBottom: 4 } }, '自訂備註'),
              h('textarea', {
                value: portfolioNotes?.customNotes || '',
                onChange: (e) =>
                  setPortfolioNotes((prev) => ({ ...prev, customNotes: e.target.value })),
                placeholder: '這組合的策略限制、委託人要求、特殊提醒...',
                style: {
                  width: '100%',
                  background: C.subtle,
                  border: `1px solid ${C.border}`,
                  borderRadius: 7,
                  padding: 8,
                  color: C.text,
                  fontSize: 11,
                  resize: 'vertical',
                  minHeight: 72,
                  fontFamily: 'inherit',
                  lineHeight: 1.7,
                },
              })
            )
          )
        : h(
            'div',
            {
              style: {
                marginTop: 12,
                fontSize: 12,
                color: C.textMute,
                background: C.subtle,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: '8px 8px',
                lineHeight: 1.7,
              },
            },
            '目前在全部總覽模式，資料維持唯讀。要編輯 notes，先用上方「打開」切回某個單一組合。'
          )
    )
  const urgentAlertBlock =
    viewMode !== OVERVIEW_VIEW_MODE &&
    urgentCount > 0 &&
    h(
      'div',
      {
        style: {
          background: alpha(C.up, '12'),
          border: `1px solid ${alpha(C.up, A.line)}`,
          borderLeft: `3px solid ${C.up}`,
          borderRadius: 6,
          padding: '4px 8px',
          marginBottom: 8,
          fontSize: 12,
          color: C.textSec,
          lineHeight: 1.6,
          fontWeight: 500,
        },
      },
      `今日 · ${todayAlertSummary}`
    )
  const overviewNoticeBlock =
    viewMode === OVERVIEW_VIEW_MODE &&
    h(
      'div',
      {
        style: {
          background: C.subtle,
          border: `1px solid ${C.border}`,
          borderRadius: C.radii.md,
          padding: '8px 8px',
          marginBottom: 4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        },
      },
      h(
        'span',
        { style: { fontSize: 12, color: C.textSec } },
        '全部總覽模式只讀，不會寫本機資料，也不會同步雲端。'
      ),
      h(
        'button',
        {
          className: 'ui-btn',
          onClick: exitOverview,
          style: {
            background: alpha(C.ink, '10'),
            color: C.textSec,
            border: `1px solid ${alpha(C.ink, A.strongLine)}`,
            ...ghostBtn,
          },
        },
        '返回目前組合'
      )
    )
  const tabsBlock =
    viewMode !== OVERVIEW_VIEW_MODE &&
    h(
      'div',
      {
        className: 'seg',
        style: {
          display: 'grid',
          gap: 6,
          padding: isMobile ? (isCompactLandscape ? '0 0 2px' : '0 0 8px') : '4px 0 4px',
          position: 'relative',
        },
      },
      isMobile
        ? h(
            'div',
            {
              style: {
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
              },
            },
            visibleMobileTabs.map((tabItem) => renderTabButton(tabItem, { compact: true })),
            hiddenMobileTabs.length > 0 &&
              h(
                'button',
                {
                  type: 'button',
                  className: 'ui-btn',
                  'data-testid': 'mobile-tabs-more-toggle',
                  'aria-expanded': isMobileTabsOpen,
                  'aria-controls': 'mobile-tabs-drawer',
                  onClick: () => setIsMobileTabsOpen((open) => !open),
                  style: {
                    ...ghostBtn,
                    minHeight: isCompactLandscape ? 32 : 44,
                    minWidth: isCompactLandscape ? 38 : 44,
                    padding: isCompactLandscape ? '4px 10px' : '8px 10px',
                    background: isMobileTabsOpen ? alpha(C.ink, '10') : C.subtle,
                    color: C.textSec,
                    border: `1px solid ${isMobileTabsOpen ? alpha(C.ink, A.strongLine) : C.border}`,
                    fontSize: 10,
                    lineHeight: isCompactLandscape ? 1 : undefined,
                  },
                },
                isMobileTabsOpen ? '收合' : `更多 ${hiddenMobileTabs.length}`
              )
          )
        : h(
            'div',
            {
              style: {
                display: 'flex',
                gap: 4,
                overflowX: 'auto',
              },
            },
            tabs.map((tabItem) => renderTabButton(tabItem))
          ),
      isMobile &&
        isMobileTabsOpen &&
        hiddenMobileTabs.length > 0 &&
        h(
          'div',
          {
            id: 'mobile-tabs-drawer',
            'data-testid': 'mobile-tabs-drawer',
            style: {
              ...card,
              padding: '10px',
              display: 'grid',
              gap: 6,
            },
          },
          h('div', { style: { ...lbl, marginBottom: 0, color: C.textSec } }, '更多分頁'),
          h(
            'div',
            {
              style: {
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
              },
            },
            hiddenMobileTabs.map((tabItem) =>
              renderTabButton(tabItem, { compact: true, fill: true })
            )
          )
        )
    )
  const mobileActionsSheet =
    isMobileActionsOpen &&
    h(
      'div',
      {
        id: 'header-mobile-actions-drawer',
        'data-testid': 'header-mobile-actions-drawer',
        style: {
          position: 'fixed',
          top: isCompactLandscape ? 54 : 64,
          left: 12,
          right: 12,
          zIndex: 30,
          maxHeight: 'calc(100vh - 148px)',
          overflowY: 'auto',
          ...card,
          padding: '12px',
          display: 'grid',
          gap: 12,
        },
      },
      h('div', { style: { ...lbl, marginBottom: 0, color: C.textSec } }, '更多操作'),
      h(
        'div',
        {
          style: {
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          },
        },
        refreshPricesButton,
        headerNoticeControl,
        weeklyReportControls,
        onboardingHelpButton,
        exportBackupButton,
        importBackupLabel
      ),
      portfolioSelectorBlock,
      portfolioManagerBlock,
      urgentAlertBlock,
      overviewNoticeBlock,
      h(
        'div',
        {
          style: {
            display: 'grid',
            gap: 4,
          },
        },
        h('div', { style: { fontSize: 11, color: C.textSec, fontWeight: 600 } }, '同步狀態'),
        h(
          'div',
          { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
          cloudIndicator,
          savedLabel
        ),
        priceSyncMeta,
        lastUpdateMeta
      ),
      backupImportInput
    )
  const mobileBottomTabsBlock =
    viewMode !== OVERVIEW_VIEW_MODE &&
    h(
      'nav',
      {
        'data-testid': 'mobile-bottom-tab-bar',
        'aria-label': '主要分頁',
        'aria-hidden': isOverlayBlocking ? 'true' : undefined,
        style: {
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          background: alpha(C.raised, 'fb'),
          borderTop: `1px solid ${C.borderSoft}`,
          boxShadow: '0 -10px 24px rgba(11,18,14,0.08)',
          padding: '6px 8px calc(6px + env(safe-area-inset-bottom))',
          ...overlayBlockingStyle,
        },
      },
      h(
        'div',
        {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
            gap: 2,
            alignItems: 'stretch',
          },
        },
        visibleMobileTabs.map((tabItem) =>
          renderTabButton(tabItem, { compact: true, fill: true, mobileBottom: true })
        ),
        hiddenMobileTabs.length > 0 &&
          h(
            'button',
            {
              type: 'button',
              className: 'ui-btn',
              'data-testid': 'mobile-tabs-more-toggle',
              'aria-expanded': isMobileTabsOpen,
              'aria-controls': 'mobile-tabs-drawer',
              tabIndex: isOverlayBlocking ? -1 : undefined,
              onClick: () => setIsMobileTabsOpen((open) => !open),
              style: {
                ...ghostBtn,
                minHeight: 50,
                minWidth: 0,
                padding: '6px 4px',
                background: isMobileTabsOpen ? alpha(C.ink, '10') : 'transparent',
                color: C.textSec,
                border: 'none',
                borderBottom: isMobileTabsOpen ? `2px solid ${C.cta}` : '2px solid transparent',
                fontSize: 10,
                lineHeight: 1.15,
              },
            },
            h(
              'span',
              {
                style: {
                  display: 'grid',
                  gap: 2,
                  justifyItems: 'center',
                },
              },
              h('span', { style: { fontSize: 18, lineHeight: '15px' } }, '⋯'),
              h('span', null, '更多')
            )
          )
      ),
      isMobileTabsOpen &&
        hiddenMobileTabs.length > 0 &&
        h(
          'div',
          {
            id: 'mobile-tabs-drawer',
            'data-testid': 'mobile-tabs-drawer',
            style: {
              position: 'absolute',
              right: 8,
              bottom: 'calc(100% + 8px)',
              width: 176,
              ...card,
              padding: '8px',
              display: 'grid',
              gap: 6,
            },
          },
          hiddenMobileTabs.map((tabItem) =>
            renderTabButton(tabItem, { compact: true, fill: true, mobileBottom: true })
          )
        )
    )

  if (!isMobile)
    return h(
      'header',
      {
        className: 'app-shell',
        'data-testid': 'header-root',
        'aria-label': '持倉工作台頁首',
        style: {
          ...shellSurface,
          borderBottom: `1px solid ${C.borderSoft}`,
          padding: '8px 12px 0',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        },
      },
      h(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 8,
          },
        },
        h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              rowGap: 8,
              flex: 1,
              minWidth: 0,
              flexWrap: 'wrap',
            },
          },
          cloudIndicator,
          titleText,
          insiderBadge || null,
          savedLabel,
          refreshPricesButton,
          weeklyReportControls,
          onboardingHelpButton,
          exportBackupButton,
          importBackupLabel,
          backupImportInput,
          priceSyncMeta,
          lastUpdateMeta
        ),
        h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              flexShrink: 0,
              paddingLeft: 8,
              position: 'relative',
            },
          },
          headerNoticeControl,
          pnlSummary
        )
      ),
      portfolioSelectorBlock,
      portfolioManagerBlock,
      urgentAlertBlock,
      viewMode === OVERVIEW_VIEW_MODE ? overviewNoticeBlock : tabsBlock,

      h(TextFieldDialog, {
        open: Boolean(editor?.isOpen),
        title: editor?.mode === 'rename' ? '重新命名組合' : '建立新組合',
        subtitle:
          editor?.mode === 'rename'
            ? `調整「${displayPortfolioName(editor?.targetPortfolio)}」的顯示名稱`
            : '建立新的投資組合與獨立本機資料空間',
        label: '組合名稱',
        value: editor?.name || '',
        onChange: (event) => editor?.setName?.(event.target.value),
        onSubmit: editor?.submit,
        onCancel: editor?.close,
        submitLabel: editor?.mode === 'rename' ? '儲存新名稱' : '建立組合',
        placeholder: editor?.mode === 'rename' ? '輸入新的組合名稱' : '例如：成長股策略 / 委託人 A',
        busy: Boolean(editor?.submitting),
        submitDisabled: !String(editor?.name || '').trim(),
      }),
      h(ConfirmDialog, {
        open: Boolean(deleteDialog?.isOpen),
        title: '刪除組合',
        message: `確定要刪除「${displayPortfolioName(deleteDialog?.targetPortfolio)}」嗎？\n這會清掉該組合的本機資料，且無法復原。`,
        confirmLabel: '確認刪除',
        cancelLabel: '取消',
        busy: Boolean(deleteDialog?.submitting),
        tone: 'danger',
        onConfirm: deleteDialog?.submit,
        onCancel: deleteDialog?.close,
      })
    )

  return h(
    'div',
    null,
    h(
      'header',
      {
        className: 'app-shell',
        'data-testid': 'header-root',
        'aria-label': '持倉工作台頁首',
        style: {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
        },
      },
      h(
        'div',
        {
          style: {
            ...shellSurface,
            borderBottom: `1px solid ${C.borderSoft}`,
            padding: isCompactLandscape ? '2px 12px' : '4px 12px',
          },
        },
        mobileTitleRow
      )
    ),
    mobileActionsSheet,
    h('div', {
      'data-testid': 'header-scroll-zone',
      style: {
        padding: `${isCompactLandscape ? 58 : 68}px 12px 0`,
      },
    }),
    mobileBottomTabsBlock,
    h(TextFieldDialog, {
      open: Boolean(editor?.isOpen),
      title: editor?.mode === 'rename' ? '重新命名組合' : '建立新組合',
      subtitle:
        editor?.mode === 'rename'
          ? `調整「${displayPortfolioName(editor?.targetPortfolio)}」的顯示名稱`
          : '建立新的投資組合與獨立本機資料空間',
      label: '組合名稱',
      value: editor?.name || '',
      onChange: (event) => editor?.setName?.(event.target.value),
      onSubmit: editor?.submit,
      onCancel: editor?.close,
      submitLabel: editor?.mode === 'rename' ? '儲存新名稱' : '建立組合',
      placeholder: editor?.mode === 'rename' ? '輸入新的組合名稱' : '例如：成長股策略 / 委託人 A',
      busy: Boolean(editor?.submitting),
      submitDisabled: !String(editor?.name || '').trim(),
    }),
    h(ConfirmDialog, {
      open: Boolean(deleteDialog?.isOpen),
      title: '刪除組合',
      message: `確定要刪除「${displayPortfolioName(deleteDialog?.targetPortfolio)}」嗎？\n這會清掉該組合的本機資料，且無法復原。`,
      confirmLabel: '確認刪除',
      cancelLabel: '取消',
      busy: Boolean(deleteDialog?.submitting),
      tone: 'danger',
      onConfirm: deleteDialog?.submit,
      onCancel: deleteDialog?.close,
    })
  )
}
