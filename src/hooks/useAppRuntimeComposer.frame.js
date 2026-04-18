export function composeAppShellFrameRuntime({
  ready,
  loadingMessage,
  loadingState,
  headerBoundaryCopy,
  headerProps,
  panelsData,
  panelsActions,
  panels,
  confirmDialog,
  closeAppConfirmDialog,
}) {
  return {
    ready,
    loadingMessage,
    loadingState,
    headerBoundaryCopy,
    headerProps,
    panelsData,
    panelsActions,
    panelsProps: {
      viewMode: panels.viewMode,
      overviewViewMode: panels.overviewViewMode,
      tab: panels.tab,
      errorBoundaryCopy: panels.errorBoundaryCopy,
    },
    confirmDialogProps: {
      open: confirmDialog.open,
      title: confirmDialog.title,
      message: confirmDialog.message,
      confirmLabel: confirmDialog.confirmLabel,
      cancelLabel: confirmDialog.cancelLabel,
      tone: confirmDialog.tone,
      onConfirm: () => closeAppConfirmDialog(true),
      onCancel: () => closeAppConfirmDialog(false),
    },
  }
}
