import { createElement as h } from 'react'
import { DashboardPanel } from '../components/overview/DashboardPanel.jsx'
import { useRouteDashboardPage } from '../hooks/useRouteDashboardPage.js'

export function DashboardPage() {
  const panelProps = useRouteDashboardPage()

  return h(DashboardPanel, panelProps)
}
export default DashboardPage
