import { useDailyAnalysisWorkflow } from './useDailyAnalysisWorkflow.js'
import { composeDailyAnalysisWorkflowArgs } from './useAppRuntimeComposer.js'

export function useAppDailyAnalysisRuntime(workflowArgs, refreshAnalystReportsRef) {
  return useDailyAnalysisWorkflow({
    ...composeDailyAnalysisWorkflowArgs(workflowArgs),
    refreshAnalystReportsRef,
  })
}
