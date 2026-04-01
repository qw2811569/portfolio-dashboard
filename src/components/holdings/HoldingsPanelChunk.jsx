import { HoldingsPanel, HoldingsTable } from './index.js'

export default function HoldingsPanelChunk({ panelProps, tableProps }) {
  return (
    <HoldingsPanel {...panelProps}>
      <HoldingsTable {...tableProps} />
    </HoldingsPanel>
  )
}
