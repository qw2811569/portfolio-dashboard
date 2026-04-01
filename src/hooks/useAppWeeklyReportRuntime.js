import { useWeeklyReportClipboard } from './useWeeklyReportClipboard.js'
import { composeWeeklyReportClipboardArgs } from './useAppRuntimeComposer.js'

export function useAppWeeklyReportRuntime(workflowArgs) {
  return useWeeklyReportClipboard(composeWeeklyReportClipboardArgs(workflowArgs))
}
