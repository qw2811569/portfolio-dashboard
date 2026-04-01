import AppShellFrame from './components/AppShellFrame.jsx'
import { useAppRuntime } from './hooks/useAppRuntime.js'

export default function App() {
  const runtime = useAppRuntime()
  return <AppShellFrame {...runtime} />
}
