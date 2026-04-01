import { useState } from 'react'
import { useStressTestWorkflow } from './useStressTestWorkflow.js'
import { composeStressTestWorkflowArgs } from './useAppRuntimeComposer.js'

export function useAppStressTestRuntime({ workflowArgs, analyzing, setAnalyzeStep }) {
  const [stressTesting, setStressTesting] = useState(false)
  const [stressResult, setStressResult] = useState(null)

  const { runStressTest } = useStressTestWorkflow(
    composeStressTestWorkflowArgs({
      ...workflowArgs,
      stressTesting,
      analyzing,
      setStressTesting,
      setAnalyzeStep,
      setStressResult,
    })
  )

  return {
    stressTesting,
    stressResult,
    setStressResult,
    runStressTest,
  }
}
