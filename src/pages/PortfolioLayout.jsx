import { createElement as h, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Header from '../components/Header.jsx'
import { ConfirmDialog } from '../components/common/Dialogs.jsx'
import { useAppConfirmationDialog } from '../hooks/useAppConfirmationDialog.js'
import { useRoutePortfolioRuntime } from '../hooks/useRoutePortfolioRuntime.js'

const ROUTE_SHELL_NOTICE =
  '路由頁面仍屬遷移殼層，部分操作只會停留在 route-local 狀態，不會同步回主 AppShell。'

export function PortfolioLayout() {
  const { headerProps, outletContext: baseOutletContext } = useRoutePortfolioRuntime()
  const { appConfirmDialog, requestAppConfirmation, closeAppConfirmDialog } =
    useAppConfirmationDialog()

  useEffect(() => {
    if (!import.meta.env.PROD) {
      console.warn(
        '[route-shell] migration-only runtime: canonical entry remains src/main.jsx -> src/App.jsx'
      )
    }
  }, [])

  const outletContext = {
    ...baseOutletContext,
    requestAppConfirmation,
    closeAppConfirmDialog,
  }

  return h(
    'div',
    {
      style: { minHeight: '100vh' },
      'data-route-shell': 'true',
      'data-route-shell-limited': 'true',
      'data-testid': 'route-shell-root',
    },
    h(
      'div',
      {
        style: {
          padding: '8px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255, 196, 0, 0.08)',
          color: '#f3c96b',
          fontSize: 12,
          lineHeight: 1.6,
        },
        'data-testid': 'route-shell-notice',
      },
      ROUTE_SHELL_NOTICE
    ),
    h(Header, headerProps),
    h('div', { style: { padding: '10px 14px' } }, h(Outlet, { context: outletContext })),
    h(ConfirmDialog, {
      open: appConfirmDialog.open,
      title: appConfirmDialog.title,
      message: appConfirmDialog.message,
      confirmLabel: appConfirmDialog.confirmLabel,
      cancelLabel: appConfirmDialog.cancelLabel,
      tone: appConfirmDialog.tone,
      onConfirm: () => closeAppConfirmDialog(true),
      onCancel: () => closeAppConfirmDialog(false),
    })
  )
}
