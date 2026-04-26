import AppShellFrame from './components/AppShellFrame.jsx'
import { OverlayProvider } from './components/common/AppOverlay.jsx'
import { useAppRuntime } from './hooks/useAppRuntime.js'

export default function App() {
  const runtime = useAppRuntime()
  return (
    <OverlayProvider>
      <AppShellFrame {...runtime} />
    </OverlayProvider>
  )
}
