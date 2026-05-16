import { useSession } from '../context/SessionContext'

const QUICK_LINKS = [
  { label: 'About',       screen: 'about' },
  { label: 'Practice',   screen: 'practice' },
  { label: 'Leaderboard',screen: 'leaderboard' },
]

export default function AppFooter() {
  const { navigateTo } = useSession()

  return (
    <footer className="border-t border-border mt-24">
      <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">

        {/* Logo + copyright */}
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-primary text-primary-foreground font-display text-sm font-bold">
            m
          </div>
          <span className="text-sm text-ink-soft">
            © {new Date().getFullYear()} Math Buddy. Built for curious minds.
          </span>
        </div>

        {/* Quick links */}
        <nav className="flex gap-6" aria-label="Footer navigation">
          {QUICK_LINKS.map((link) => (
            <button
              key={link.screen}
              type="button"
              onClick={() => navigateTo(link.screen)}
              className="text-sm text-ink-soft hover:text-ink transition-colors"
            >
              {link.label}
            </button>
          ))}
        </nav>
      </div>
    </footer>
  )
}
