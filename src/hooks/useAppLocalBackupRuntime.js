import { useLocalBackupWorkflow } from './useLocalBackupWorkflow.js'
import { composeLocalBackupWorkflowArgs } from './useAppRuntimeComposer.js'

export function useAppLocalBackupRuntime({
  workflowArgs,
  portfolioTransitionRef,
  cloudSyncStateRef,
  livePortfolioSnapshot,
}) {
  return useLocalBackupWorkflow({
    ...composeLocalBackupWorkflowArgs(workflowArgs),
    portfolioTransitionRef,
    cloudSyncStateRef,
    liveSnapshot: livePortfolioSnapshot,
  })
}
