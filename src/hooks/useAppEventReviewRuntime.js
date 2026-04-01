import { useEventReviewWorkflow } from './useEventReviewWorkflow.js'
import { composeEventReviewWorkflowArgs } from './useAppRuntimeComposer.js'

export function useAppEventReviewRuntime(workflowArgs) {
  return useEventReviewWorkflow(composeEventReviewWorkflowArgs(workflowArgs))
}
