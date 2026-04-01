import { useTradeCaptureRuntime } from './useTradeCaptureRuntime.js'
import { useAppCallbackRefs } from './useAppCallbackRefs.js'
import { composeTradeCaptureRuntimeArgs } from './useAppRuntimeComposer.js'

export function useAppTradeRuntime({
  workflowArgs,
  refreshAnalystReportsRef,
  refreshAnalystReports,
  resetTradeCaptureRef,
}) {
  const tradeCapture = useTradeCaptureRuntime(composeTradeCaptureRuntimeArgs(workflowArgs))

  useAppCallbackRefs({
    refreshAnalystReportsRef,
    refreshAnalystReports,
    resetTradeCaptureRef,
    resetTradeCapture: tradeCapture.resetTradeCapture,
  })

  return tradeCapture
}
