import { useEffect } from 'react'
import { useSession } from '../context/SessionContext'
import { theme, setTheme } from '../themes/dandysWorld'
import HomeScreen from './HomeScreen'
import LoadingScreen from '../components/LoadingScreen'
import PracticePage from './PracticePage'
import Dashboard from './Dashboard'
import ErrorBanner from '../components/ErrorBanner'

/**
 * Top-level screen router.
 * Reads `screen` from SessionContext and renders the appropriate component.
 * The `#theme-root` wrapper is the single element that receives all CSS variables.
 */
export default function App() {
  const { state } = useSession()

  // Apply default theme on first mount
  useEffect(() => {
    setTheme(theme)
  }, [])

  function renderScreen() {
    switch (state.screen) {
      case 'home':
        return <HomeScreen />
      case 'loading':
        return <LoadingScreen funFacts={state.funFacts} message="Generating your questions…" />
      case 'practice':
        return <PracticePage />
      case 'evaluating':
        return <LoadingScreen funFacts={state.funFacts} message="Marking your answers…" />
      case 'dashboard':
        return <Dashboard />
      default:
        return <HomeScreen />
    }
  }

  return (
    <div id="theme-root" className="min-h-screen bg-background font-body">
      {state.error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
          <ErrorBanner message={state.error.message} onRetry={state.error.retryFn} />
        </div>
      )}
      {renderScreen()}
    </div>
  )
}
