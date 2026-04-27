import { createElement as h, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Header from '../components/Header.jsx'
import { ConfirmDialog } from '../components/common/Dialogs.jsx'
import { ErrorBoundary } from '../components/ErrorBoundary.jsx'
import { useAppConfirmationDialog } from '../hooks/useAppConfirmationDialog.js'
import { useRoutePortfolioRuntime } from '../hooks/useRoutePortfolioRuntime.js'

export function PortfolioLayout() {
  const { headerProps, outletContext: baseOutletContext } = useRoutePortfolioRuntime()
  const { appConfirmDialog, requestAppConfirmation, closeAppConfirmDialog } =
    useAppConfirmationDialog()

  useEffect(() => {
    if (!import.meta.env.PROD) {
      console.warn(
        '[route-shell] migration-only runtime: canonical entry remains src/main.jsx -> src/App.jsx. 路由頁面仍屬遷移殼層，部分操作不會同步回主 AppShell；正式 runtime 仍以主 AppShell 為準。'
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
    h(Header, headerProps),
    h(
      'div',
      { className: 'route-content', style: { padding: '8px 12px' } },
      h(
        ErrorBoundary,
        { scope: 'portfolio-route', title: '這個頁面' },
        h(Outlet, { context: outletContext })
      )
    ),
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
