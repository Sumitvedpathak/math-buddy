import { useState, useEffect, useCallback } from 'react'
import { useSession } from '../context/SessionContext'

const NAV_LINKS = [
  { label: 'Home',        screen: 'home' },
  { label: 'Practice',   screen: 'practice', disabled: true },
  { label: 'Leaderboard',screen: 'leaderboard', disabled: true },
  { label: 'About',      screen: 'about' },
]

export default function AppHeader() {
  const { state, navigateTo } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleNav = useCallback((screen) => {
    navigateTo(screen)
    setMenuOpen(false)
  }, [navigateTo])

  // Close hamburger when viewport grows past mobile breakpoint
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMenuOpen(false) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">

        {/* Logo + wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="flex items-center gap-2.5 group"
          aria-label="Math Buddy home"
        >
          <div className="relative grid h-9 w-9 place-items-center rounded-lg bg-gradient-primary text-primary-foreground font-display text-lg font-bold transition-transform group-hover:rotate-6 glow-primary">
            m
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-lg font-semibold tracking-tight text-ink">
              Math Buddy
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-accent">
              Learn · Practice · Master
            </span>
          </div>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {NAV_LINKS.map((link) => {
            const active = state.screen === link.screen
            return (
              <button
                key={link.screen}
                type="button"
                onClick={() => !link.disabled && handleNav(link.screen)}
                aria-current={active ? 'page' : undefined}
                disabled={link.disabled}
                className={[
                  'rounded-full px-3.5 py-2 text-sm transition-colors',
                  link.disabled
                    ? 'text-muted-foreground cursor-not-allowed opacity-50'
                    : active
                    ? 'bg-surface-elevated font-medium text-ink'
                    : 'text-ink-soft hover:text-ink hover:bg-surface-elevated',
                ].join(' ')}
              >
                {link.label}
              </button>
            )
          })}
        </nav>

        {/* Desktop CTA */}
        <button
          type="button"
          onClick={() => handleNav('practice')}
          className="hidden md:inline-flex items-center gap-2 rounded-full bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground glow-primary hover:scale-[1.03] transition-transform"
          aria-label="Start practising"
        >
          Start practising
          <span aria-hidden="true">→</span>
        </button>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden flex flex-col justify-center items-center gap-1.5 p-2 rounded-md transition hover:bg-surface-elevated"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        >
          <span className={`block h-0.5 w-6 rounded bg-ink transition-transform duration-300 ${menuOpen ? 'translate-y-2 rotate-45' : ''}`} />
          <span className={`block h-0.5 w-6 rounded bg-ink transition-opacity duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block h-0.5 w-6 rounded bg-ink transition-transform duration-300 ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl px-6 py-3 space-y-1">
          {NAV_LINKS.map((link) => {
            const active = state.screen === link.screen
            return (
              <button
                key={link.screen}
                type="button"
                onClick={() => !link.disabled && handleNav(link.screen)}
                disabled={link.disabled}
                className={[
                  'flex w-full items-center rounded-md px-4 py-3 text-sm font-medium transition-colors',
                  link.disabled
                    ? 'text-muted-foreground cursor-not-allowed opacity-50'
                    : active
                    ? 'bg-surface-elevated text-ink'
                    : 'text-ink-soft hover:bg-surface-elevated hover:text-ink',
                ].join(' ')}
              >
                {link.label}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => handleNav('practice')}
            className="w-full mt-2 rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Start practising →
          </button>
        </div>
      )}
    </header>
  )
}
