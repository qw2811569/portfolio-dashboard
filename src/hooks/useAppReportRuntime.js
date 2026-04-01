import { useReportRefreshWorkflow } from './useReportRefreshWorkflow.js'
import { usePostCloseSelfHealSync } from './usePostCloseSelfHealSync.js'
import { useResearchAutoRefresh } from './useResearchAutoRefresh.js'
import { composeReportRefreshWorkflowArgs } from './useAppRuntimeComposer.js'

export function useAppReportRuntime({ reportArgs, postCloseSyncArgs, researchAutoRefreshArgs }) {
  const reportRuntime = useReportRefreshWorkflow(composeReportRefreshWorkflowArgs(reportArgs))

  usePostCloseSelfHealSync(postCloseSyncArgs)
  useResearchAutoRefresh({
    ...researchAutoRefreshArgs,
    reportRefreshing: reportRuntime.reportRefreshing,
  })

  return reportRuntime
}
