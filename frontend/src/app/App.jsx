import { useEffect } from 'react'
import { useSession } from '../context/SessionContext'
import { theme, setTheme } from '../themes/dandysWorld'
import HomeScreen from './HomeScreen'
import ProfileScreen from './ProfileScreen'
import LoadingScreen from '../components/LoadingScreen'
import PracticePage from './PracticePage'
import Dashboard from './Dashboard'
import Leaderboard from './Leaderboard'
import About from './About'
import ErrorBanner from '../components/ErrorBanner'
import AppHeader from '../components/AppHeader'
import AppFooter from '../components/AppFooter'

export default function App() {
  const { state } = useSession()

  useEffect(() => {
    setTheme(theme)
  }, [])

  function renderScreen() {
    // Resuming a cached profile — wait for it so grade-gated UI doesn't flash.
    if (state.profileStatus === 'loading') {
      return <LoadingScreen funFacts={state.funFacts} message="Loading your profile…" />
    }
    switch (state.screen) {
      case 'profile':
        return <ProfileScreen />
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
      case 'leaderboard':
        return <Leaderboard />
      case 'about':
        return <About />
      default:
        return <HomeScreen />
    }
  }

  return (
    <div id="theme-root" className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader />
      {state.error && (
        <ErrorBanner message={state.error.message} onRetry={state.error.retryFn} />
      )}
      <div className="flex-1">
        {renderScreen()}
      </div>
      <AppFooter />
    </div>
  )
}
