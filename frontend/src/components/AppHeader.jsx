import { useState, useCallback } from 'react'
import { useSession } from '../context/SessionContext'

/**
 * AppHeader — fixed top navigation bar.
 * Height: 64px desktop / 56px mobile.
 * Frosted-glass dark background with glowing accent bottom border.
 * Collapses to hamburger on mobile.
 */
export default function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { goHome } = useSession()

  const toggleMenu = useCallback(() => setMenuOpen((v) => !v), [])
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  const handleHomeClick = useCallback(() => {
    closeMenu()
    if (goHome) goHome()
  }, [closeMenu, goHome])

  const navLinks = [
    { label: 'Home', action: handleHomeClick, active: true },
    { label: 'Practice', action: null, comingSoon: true },
    { label: 'Leaderboard', action: null, comingSoon: true },
    { label: 'About', action: null, comingSoon: true },
  ]

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 md:px-8"
        style={{
          height: '64px',
          background: 'rgba(15,10,30,0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid transparent',
          backgroundClip: 'padding-box',
          boxShadow: '0 1px 0 0 rgba(167,139,250,0.35), 0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* Logo + wordmark */}
        <button
          type="button"
          onClick={handleHomeClick}
          className="flex items-center gap-2.5 group"
          aria-label="Math Buddy home"
        >
          {/* Inline SVG logo: star wearing a graduation cap */}
          <svg
            width="40"
            height="40"
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Glow circle */}
            <circle cx="20" cy="22" r="14" fill="rgba(167,139,250,0.15)" />
            {/* Star body */}
            <polygon
              points="20,8 23,16 32,16 25,21 27,30 20,25 13,30 15,21 8,16 17,16"
              fill="#a78bfa"
            />
            <polygon
              points="20,10 22.5,17 30,17 24,21.5 26,29 20,25 14,29 16,21.5 10,17 17.5,17"
              fill="#c4b5fd"
            />
            {/* Graduation cap board */}
            <ellipse cx="20" cy="9" rx="9" ry="3" fill="#facc15" />
            <rect x="11" y="6" width="18" height="4" rx="2" fill="#eab308" />
            {/* Cap top */}
            <rect x="17.5" y="2" width="5" height="6" rx="1.5" fill="#eab308" />
            {/* Tassel */}
            <circle cx="28" cy="9" r="2" fill="#facc15" />
            <line x1="28" y1="11" x2="28" y2="17" stroke="#facc15" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="28" cy="18" r="1.5" fill="#facc15" />
            {/* Sparkle */}
            <path d="M33 4 L34 7 L37 8 L34 9 L33 12 L32 9 L29 8 L32 7 Z" fill="#38bdf8" opacity="0.9" />
            <path d="M5 18 L6 20 L8 21 L6 22 L5 24 L4 22 L2 21 L4 20 Z" fill="#4ade80" opacity="0.8" />
          </svg>

          <span
            className="font-heading text-xl font-extrabold tracking-tight transition-all group-hover:opacity-80"
            style={{ color: '#facc15', textShadow: '0 0 16px rgba(250,204,21,0.4)' }}
          >
            Math Buddy
          </span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {navLinks.map((link) => (
            <NavItem key={link.label} {...link} />
          ))}
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden flex flex-col justify-center items-center gap-1.5 p-2 rounded-button transition hover:bg-white/10"
          onClick={toggleMenu}
          aria-expanded={menuOpen}
          aria-label="Toggle navigation menu"
        >
          <span
            className="block h-0.5 w-6 rounded transition-all duration-300"
            style={{
              background: '#f0e6ff',
              transform: menuOpen ? 'translateY(8px) rotate(45deg)' : 'none',
            }}
          />
          <span
            className="block h-0.5 w-6 rounded transition-all duration-300"
            style={{
              background: '#f0e6ff',
              opacity: menuOpen ? 0 : 1,
            }}
          />
          <span
            className="block h-0.5 w-6 rounded transition-all duration-300"
            style={{
              background: '#f0e6ff',
              transform: menuOpen ? 'translateY(-8px) rotate(-45deg)' : 'none',
            }}
          />
        </button>
      </header>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div
          className="fixed top-14 left-0 right-0 z-30 md:hidden px-4 py-3 space-y-1"
          style={{
            background: 'rgba(15,10,30,0.95)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(167,139,250,0.25)',
          }}
        >
          {navLinks.map((link) => (
            <MobileNavItem key={link.label} {...link} onClose={closeMenu} />
          ))}
        </div>
      )}

      {/* Spacer so page content doesn't hide under the fixed header */}
      <div className="h-16" aria-hidden="true" />
    </>
  )
}

/** Desktop nav item */
function NavItem({ label, action, comingSoon }) {
  if (comingSoon) {
    return (
      <div className="relative group">
        <button
          type="button"
          disabled
          className="px-4 py-2 rounded-button text-sm font-semibold transition cursor-default"
          style={{ color: 'rgba(168,158,196,0.5)' }}
        >
          {label}
        </button>
        {/* Tooltip */}
        <span
          className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap rounded-button px-2.5 py-1 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{
            background: 'rgba(167,139,250,0.9)',
            color: '#0f0a1e',
            boxShadow: '0 0 12px rgba(167,139,250,0.4)',
          }}
        >
          Coming Soon
        </span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={action}
      className="px-4 py-2 rounded-button text-sm font-semibold transition hover:bg-white/10"
      style={{ color: '#f0e6ff' }}
    >
      {label}
    </button>
  )
}

/** Mobile nav item */
function MobileNavItem({ label, action, comingSoon, onClose }) {
  function handleClick() {
    if (action) {
      action()
    }
    onClose()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={comingSoon}
      className="flex w-full items-center justify-between rounded-button px-4 py-3 text-sm font-semibold transition"
      style={comingSoon
        ? { color: 'rgba(168,158,196,0.4)', cursor: 'default' }
        : { color: '#f0e6ff', background: 'rgba(255,255,255,0.05)' }
      }
    >
      {label}
      {comingSoon && (
        <span
          className="rounded-full px-2 py-0.5 text-xs font-bold"
          style={{ background: 'rgba(167,139,250,0.25)', color: '#a78bfa' }}
        >
          Soon
        </span>
      )}
    </button>
  )
}
