import { createElement as h } from 'react'
import HoldingsPanelChunk from '../components/holdings/HoldingsPanelChunk.jsx'
import { useRouteHoldingsPage } from '../hooks/useRouteHoldingsPage.js'

export function HoldingsPage() {
  const { panelProps, tableProps } = useRouteHoldingsPage()

  return h(HoldingsPanelChunk, { panelProps, tableProps })
}
export default HoldingsPage
