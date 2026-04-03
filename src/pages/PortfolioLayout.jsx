import { createElement as h } from 'react'
import { Outlet } from 'react-router-dom'
import Header from '../components/Header.jsx'
import { ConfirmDialog } from '../components/common/Dialogs.jsx'
import { useAppConfirmationDialog } from '../hooks/useAppConfirmationDialog.js'
import { useRoutePortfolioRuntime } from '../hooks/useRoutePortfolioRuntime.js'

export function PortfolioLayout() {
  const { headerProps, outletContext: baseOutletContext } = useRoutePortfolioRuntime()
  const { appConfirmDialog, requestAppConfirmation, closeAppConfirmDialog } =
    useAppConfirmationDialog()

  const outletContext = {
    ...baseOutletContext,
    requestAppConfirmation,
    closeAppConfirmDialog,
  }

  return h(
    'div',
    { style: { minHeight: '100vh' } },
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
