import { createElement as h } from 'react'
import { C, A, alpha } from '../theme.js'
import { ConfirmDialog, TextFieldDialog } from './common/index.js'

export default function Header(props) {
  const {
    cloudSync,
    saved,
    refreshPrices,
    refreshing,
    copyWeeklyReport,
    exportLocalBackup,
    backupFileInputRef,
    importLocalBackup,
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
  const tabs = Array.isArray(TABS) ? TABS : []
  const editor = portfolioEditor || null
  const deleteDialog = portfolioDeleteDialog || null
  const navigateToTab = (nextTab) => {
    if (!nextTab || typeof setTab !== 'function') return
    setTab(nextTab)
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const ghostBtn = {
    borderRadius: 999,
    padding: '5px 12px',
    fontSize: 9,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.18s ease',
  }
  const card = {
    background: `linear-gradient(180deg, ${alpha(C.card, 'f2')}, ${alpha(C.subtle, 'f4')})`,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    padding: '12px 14px',
    boxShadow: `${C.insetLine}, ${C.shadow}`,
  }
  const lbl = {
    fontSize: 10,
    color: C.textMute,
    letterSpacing: '0.08em',
    fontWeight: 500,
    marginBottom: 5,
  }

  return h(
    'div',
    {
      className: 'app-shell',
      style: {
        background: `linear-gradient(180deg, ${alpha(C.shell, 'f4')} 0%, ${alpha(C.subtleElev, 'ea')} 100%)`,
        borderBottom: `1px solid ${C.borderSoft}`,
        padding: '10px 14px 0',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: C.shellShadow,
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
      },
    },
    // Top bar
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        },
      },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 } },
        h(
          'span',
          { style: { color: cloudSync ? C.blue : C.textMute, fontSize: 9 } },
          cloudSync ? '☁' : '⚡'
        ),
        h(
          'span',
          {
            style: {
              fontSize: 20,
              fontWeight: 700,
              color: C.text,
              fontFamily: 'var(--font-headline)',
              letterSpacing: '0.01em',
            },
          },
          '持倉看板'
        ),
        saved && h('span', { style: { color: C.olive, fontSize: 9, fontWeight: 500 } }, saved),
        h(
          'button',
          {
            className: 'ui-btn',
            onClick: refreshPrices,
            disabled: refreshing,
            style: {
              background: refreshing ? C.subtle : alpha(C.blue, '10'),
              color: refreshing ? C.textMute : C.blue,
              border: `1px solid ${refreshing ? C.border : alpha(C.blue, A.strongLine)}`,
              ...ghostBtn,
              cursor: refreshing ? 'not-allowed' : 'pointer',
            },
          },
          refreshing ? '股價更新中...' : '⟳ 收盤價'
        ),
        h(
          'button',
          {
            className: 'ui-btn',
            onClick: copyWeeklyReport,
            style: {
              background: `linear-gradient(90deg, ${C.lavBg}, ${alpha(C.blue, '10')})`,
              color: C.lavender,
              border: `1px solid ${alpha(C.lavender, A.strongLine)}`,
              ...ghostBtn,
            },
          },
          '📋 週報'
        ),
        h(
          'button',
          {
            className: 'ui-btn',
            onClick: exportLocalBackup,
            style: {
              background: alpha(C.olive, '12'),
              color: C.olive,
              border: `1px solid ${alpha(C.olive, A.strongLine)}`,
              ...ghostBtn,
            },
          },
          '備份'
        ),
        h(
          'button',
          {
            className: 'ui-btn',
            onClick: () => backupFileInputRef?.current?.click(),
            style: {
              background: C.subtle,
              color: C.textSec,
              border: `1px solid ${C.border}`,
              ...ghostBtn,
            },
          },
          '匯入'
        ),
        h('input', {
          ref: backupFileInputRef,
          type: 'file',
          accept: 'application/json,.json',
          onChange: importLocalBackup,
          style: { display: 'none' },
        }),
        h(
          'span',
          { style: { fontSize: 9, color: priceSyncStatusTone, fontWeight: 600 } },
          priceSyncStatusLabel,
          activePriceSyncAt
            ? ` · ${activePriceSyncAt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`
            : ''
        ),
        lastUpdate &&
          !refreshing &&
          h(
            'span',
            { style: { fontSize: 9, color: C.textMute } },
            `更新 ${lastUpdate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`
          )
      ),
      h(
        'div',
        { className: 'tn', style: { textAlign: 'right', flexShrink: 0, paddingLeft: 8 } },
        h(
          'div',
          {
            style: {
              fontSize: 20,
              fontWeight: 700,
              color: pc(displayedTotalPnl),
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
              fontSize: 10,
              fontWeight: 600,
              color: pc(displayedRetPct),
              fontFamily: 'var(--font-num)',
            },
          },
          `${displayedRetPct >= 0 ? '+' : ''}${displayedRetPct.toFixed(2)}%`
        )
      )
    ),

    // Portfolio selector
    h(
      'div',
      {
        style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
      },
      h(
        'span',
        { style: { fontSize: 9, color: C.textMute, fontWeight: 600, letterSpacing: '0.05em' } },
        '目前組合'
      ),
      h(
        'select',
        {
          'data-testid': 'portfolio-select',
          value: activePortfolioId,
          onChange: (e) => switchPortfolio(e.target.value),
          disabled: !ready || portfolioSwitching,
          style: {
            minWidth: 190,
            background: C.subtle,
            color: C.text,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: '7px 10px',
            fontSize: 11,
            outline: 'none',
            cursor: portfolioSwitching ? 'progress' : 'pointer',
          },
        },
        portfolioSummaries.map((portfolio) =>
          h(
            'option',
            { key: portfolio.id, value: portfolio.id },
            `${portfolio.name} · ${portfolio.holdingCount}檔 · ${portfolio.retPct >= 0 ? '+' : ''}${portfolio.retPct.toFixed(1)}%`
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
            background: `linear-gradient(90deg, ${alpha(C.blue, '12')}, ${alpha(C.teal, '08')})`,
            color: C.blue,
            border: `1px solid ${alpha(C.blue, A.strongLine)}`,
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
            background:
              viewMode === OVERVIEW_VIEW_MODE
                ? `linear-gradient(90deg, ${alpha(C.amber, '12')}, ${alpha(C.choco, '10')})`
                : `linear-gradient(90deg, ${alpha(C.lavender, '10')}, ${alpha(C.rose, '10')})`,
            color: viewMode === OVERVIEW_VIEW_MODE ? C.amber : C.text,
            border: `1px solid ${viewMode === OVERVIEW_VIEW_MODE ? alpha(C.amber, A.strongLine) : alpha(C.lavender, '20')}`,
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
            style: { fontSize: 10, color: C.textSec },
          },
          viewMode === OVERVIEW_VIEW_MODE
            ? `全部總覽 · ${portfolioSummaries.length} 組合 · 總市值 ${Math.round(overviewTotalValue).toLocaleString()}`
            : `${portfolioSummaries.find((p) => p.id === activePortfolioId)?.name || ''} · ${portfolioSummaries.find((p) => p.id === activePortfolioId)?.holdingCount || 0} 檔 · 損益 ${portfolioSummaries.find((p) => p.id === activePortfolioId)?.totalPnl >= 0 ? '+' : ''}${Math.round(portfolioSummaries.find((p) => p.id === activePortfolioId)?.totalPnl || 0).toLocaleString()}`
        )
    ),

    // Portfolio manager
    showPortfolioManager &&
      h(
        'div',
        {
          style: {
            ...card,
            marginBottom: 8,
            borderLeft: `3px solid ${C.lavender}`,
            boxShadow: `${C.insetLine}, ${C.shadow}, 0 0 0 1px ${alpha(C.lavender, '10')}`,
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
              marginBottom: 10,
              flexWrap: 'wrap',
            },
          },
          h(
            'div',
            null,
            h('div', { style: { ...lbl, color: C.lavender, marginBottom: 3 } }, '組合管理'),
            h(
              'div',
              { style: { fontSize: 11, color: C.textSec } },
              '可以改名、刪除組合，並編輯目前組合的偏好備註。'
            )
          ),
          h(
            'span',
            { style: { fontSize: 9, color: C.textMute } },
            '總覽模式唯讀；切回單一組合才會寫入 notes。'
          )
        ),
        h(
          'div',
          { style: { display: 'grid', gap: 7 } },
          portfolioSummaries.map((portfolio) =>
            h(
              'div',
              {
                key: portfolio.id,
                style: {
                  background:
                    portfolio.id === activePortfolioId
                      ? `linear-gradient(90deg, ${alpha(C.lavender, '08')}, ${alpha(C.blue, '08')})`
                      : C.subtle,
                  border: `1px solid ${portfolio.id === activePortfolioId ? C.borderStrong : C.border}`,
                  borderRadius: 8,
                  padding: '10px 12px',
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
                    flexWrap: 'wrap',
                  },
                },
                h(
                  'div',
                  null,
                  h(
                    'div',
                    { style: { fontSize: 12, color: C.text, fontWeight: 600 } },
                    portfolio.name,
                    portfolio.id === OWNER_PORTFOLIO_ID &&
                      h(
                        'span',
                        { style: { fontSize: 9, color: C.textMute, marginLeft: 6 } },
                        'owner'
                      ),
                    portfolio.id === activePortfolioId &&
                      h(
                        'span',
                        { style: { fontSize: 9, color: C.lavender, marginLeft: 6 } },
                        '目前'
                      )
                  ),
                  h(
                    'div',
                    { style: { fontSize: 10, color: C.textMute, marginTop: 3 } },
                    `${portfolio.holdingCount} 檔 · 近期事件 ${portfolio.pendingEvents?.length || 0} 件 · 報酬 ${portfolio.retPct >= 0 ? '+' : ''}${portfolio.retPct.toFixed(1)}%`
                  )
                ),
                h(
                  'div',
                  { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
                  (portfolio.id !== activePortfolioId || viewMode === OVERVIEW_VIEW_MODE) &&
                    h(
                      'button',
                      {
                        className: 'ui-btn',
                        onClick: () => switchPortfolio(portfolio.id),
                        style: {
                          background: alpha(C.blue, '10'),
                          color: C.blue,
                          border: `1px solid ${alpha(C.blue, A.strongLine)}`,
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
                        color: C.amber,
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
                    { style: { fontSize: 9, color: C.textMute, marginBottom: 3 } },
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
                      padding: '8px 10px',
                      color: C.text,
                      fontSize: 11,
                      outline: 'none',
                      fontFamily: 'inherit',
                    },
                  })
                ),
                h(
                  'div',
                  null,
                  h(
                    'div',
                    { style: { fontSize: 9, color: C.textMute, marginBottom: 3 } },
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
                      padding: '8px 10px',
                      color: C.text,
                      fontSize: 11,
                      outline: 'none',
                      fontFamily: 'inherit',
                    },
                  })
                )
              ),
              h(
                'div',
                null,
                h(
                  'div',
                  { style: { fontSize: 9, color: C.textMute, marginBottom: 3 } },
                  '自訂備註'
                ),
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
                    outline: 'none',
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
                  fontSize: 10,
                  color: C.textMute,
                  background: C.subtle,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: '8px 10px',
                  lineHeight: 1.7,
                },
              },
              '目前在全部總覽模式，資料維持唯讀。要編輯 notes，先用上方「打開」切回某個單一組合。'
            )
      ),

    // Urgent alerts
    viewMode !== OVERVIEW_VIEW_MODE &&
      urgentCount > 0 &&
      h(
        'div',
        {
          style: {
            background: `linear-gradient(90deg, ${C.upBg}, ${alpha(C.amber, '12')})`,
            border: `1px solid ${alpha(C.up, A.line)}`,
            borderLeft: `3px solid ${C.up}`,
            borderRadius: 6,
            padding: '5px 10px',
            marginBottom: 8,
            fontSize: 10,
            color: C.up,
            lineHeight: 1.6,
            fontWeight: 500,
          },
        },
        `今日 · ${todayAlertSummary}`
      ),

    viewMode !== OVERVIEW_VIEW_MODE &&
      workflowCue &&
      h(
        'div',
        {
          style: {
            background: `linear-gradient(90deg, ${alpha(C.blue, '10')}, ${alpha(C.lavender, '10')})`,
            border: `1px solid ${alpha(C.blue, A.line)}`,
            borderLeft: `3px solid ${C.blue}`,
            borderRadius: 8,
            padding: '8px 10px',
            marginBottom: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          },
        },
        h(
          'div',
          { style: { minWidth: 0, flex: 1 } },
          h(
            'div',
            { style: { fontSize: 9, color: C.blue, fontWeight: 700, letterSpacing: '0.08em' } },
            'WORKFLOW CUE'
          ),
          h(
            'div',
            {
              style: {
                fontSize: 11,
                color: C.text,
                fontWeight: 600,
                lineHeight: 1.6,
                marginTop: 3,
              },
            },
            workflowCue.label
          ),
          workflowCue.reason &&
            h(
              'div',
              {
                style: {
                  fontSize: 10,
                  color: C.textSec,
                  lineHeight: 1.7,
                  marginTop: 4,
                },
              },
              workflowCue.reason
            )
        ),
        workflowCue.targetTab &&
          h(
            'button',
            {
              className: 'ui-btn',
              onClick: () => navigateToTab(workflowCue.targetTab),
              style: {
                background: alpha(C.blue, '10'),
                color: C.blue,
                border: `1px solid ${alpha(C.blue, A.strongLine)}`,
                ...ghostBtn,
              },
            },
            workflowCue.actionLabel || '前往查看'
          )
      ),

    // Overview mode notice or tabs
    viewMode === OVERVIEW_VIEW_MODE
      ? h(
          'div',
          {
            style: {
              background: C.subtle,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '8px 10px',
              marginBottom: 6,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            },
          },
          h(
            'span',
            { style: { fontSize: 10, color: C.textSec } },
            '全部總覽模式只讀，不會寫本機資料，也不會同步雲端。'
          ),
          h(
            'button',
            {
              className: 'ui-btn',
              onClick: exitOverview,
              style: {
                background: alpha(C.blue, '10'),
                color: C.blue,
                border: `1px solid ${alpha(C.blue, A.strongLine)}`,
                ...ghostBtn,
              },
            },
            '返回目前組合'
          )
        )
      : h(
          'div',
          {
            className: 'seg',
            style: { display: 'flex', gap: 6, overflowX: 'auto', padding: '2px 0 6px' },
          },
          tabs.map((t) =>
            h(
              'button',
              {
                className: 'ui-btn',
                key: t.k,
                'data-testid': `tab-${t.k}`,
                onClick: () => navigateToTab(t.k),
                style: {
                  background:
                    tab === t.k
                      ? `linear-gradient(90deg, ${alpha(C.lavender, '10')}, ${alpha(C.blue, '10')})`
                      : 'transparent',
                  color: tab === t.k ? C.text : C.textMute,
                  border: `1px solid ${tab === t.k ? alpha(C.lavender, '26') : 'transparent'}`,
                  boxShadow: tab === t.k ? `0 0 0 1px ${alpha(C.blue, '10')}` : 'none',
                  borderRadius: 999,
                  padding: '7px 13px',
                  fontSize: 11,
                  fontWeight: tab === t.k ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                },
              },
              t.label
            )
          )
        ),

    h(TextFieldDialog, {
      open: Boolean(editor?.isOpen),
      title: editor?.mode === 'rename' ? '重新命名組合' : '建立新組合',
      subtitle:
        editor?.mode === 'rename'
          ? `調整「${editor?.targetPortfolio?.name || ''}」的顯示名稱`
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
      message: `確定要刪除「${deleteDialog?.targetPortfolio?.name || ''}」嗎？\n這會清掉該組合的本機資料，且無法復原。`,
      confirmLabel: '確認刪除',
      cancelLabel: '取消',
      busy: Boolean(deleteDialog?.submitting),
      tone: 'danger',
      onConfirm: deleteDialog?.submit,
      onCancel: deleteDialog?.close,
    })
  )
}
