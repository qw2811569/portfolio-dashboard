import { useResearchWorkflow } from './useResearchWorkflow.js'
import { composeResearchWorkflowArgs } from './useAppRuntimeComposer.js'

export function useAppResearchRuntime(workflowArgs) {
  return useResearchWorkflow(composeResearchWorkflowArgs(workflowArgs))
}
