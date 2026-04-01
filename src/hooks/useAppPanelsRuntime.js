import { usePortfolioPanelsContextComposer } from './usePortfolioPanelsContextComposer.js'
import { composePortfolioPanelsContextInput } from './useAppRuntimeComposer.js'

export function useAppPanelsRuntime({ data, ui, asyncState, resources, controls, actions }) {
  return usePortfolioPanelsContextComposer(
    composePortfolioPanelsContextInput({
      data,
      ui,
      asyncState,
      resources,
      controls,
      actions,
    })
  )
}
