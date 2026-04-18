/**
 * AppFooter — persistent footer shown on all pages.
 * Three-column layout on desktop, stacks to single column on mobile.
 * Dark background with gradient accent top border.
 */
export default function AppFooter() {
  const quickLinks = ['Home', 'Privacy', 'About']

  return (
    <footer
      style={{
        background: 'rgba(8,5,16,0.95)',
        borderTop: '1px solid transparent',
        backgroundClip: 'padding-box',
        boxShadow: '0 -1px 0 0 rgba(167,139,250,0.2), inset 0 1px 0 0 rgba(56,189,248,0.1)',
      }}
    >
      {/* Gradient accent line at very top */}
      <div
        className="h-px w-full"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, #a78bfa 25%, #38bdf8 50%, #4ade80 75%, transparent 100%)',
        }}
        aria-hidden="true"
      />

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">

          {/* Left — Logo + tagline */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              {/* Mini logo SVG */}
              <svg
                width="32"
                height="32"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle cx="20" cy="22" r="14" fill="rgba(167,139,250,0.12)" />
                <polygon
                  points="20,8 23,16 32,16 25,21 27,30 20,25 13,30 15,21 8,16 17,16"
                  fill="#a78bfa"
                />
                <polygon
                  points="20,10 22.5,17 30,17 24,21.5 26,29 20,25 14,29 16,21.5 10,17 17.5,17"
                  fill="#c4b5fd"
                />
                <ellipse cx="20" cy="9" rx="9" ry="3" fill="#facc15" />
                <rect x="11" y="6" width="18" height="4" rx="2" fill="#eab308" />
                <rect x="17.5" y="2" width="5" height="6" rx="1.5" fill="#eab308" />
                <circle cx="28" cy="9" r="2" fill="#facc15" />
                <line x1="28" y1="11" x2="28" y2="17" stroke="#facc15" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span
                className="font-heading text-lg font-extrabold"
                style={{ color: '#facc15' }}
              >
                Math Buddy
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#a89ec4' }}>
              Making maths fun, one problem at a time 🚀
            </p>
          </div>

          {/* Centre — Quick links */}
          <div className="flex flex-col gap-3">
            <h3
              className="font-heading text-xs font-bold uppercase tracking-widest"
              style={{ color: '#a78bfa' }}
            >
              Quick Links
            </h3>
            <nav className="flex flex-col gap-2" aria-label="Footer navigation">
              {quickLinks.map((link) => (
                <span
                  key={link}
                  className="w-fit cursor-default text-sm transition-colors"
                  style={{ color: '#a89ec4' }}
                  title="Coming soon"
                >
                  {link}
                </span>
              ))}
            </nav>
          </div>

          {/* Right — Built with love + social placeholders */}
          <div className="flex flex-col gap-3">
            <h3
              className="font-heading text-xs font-bold uppercase tracking-widest"
              style={{ color: '#a78bfa' }}
            >
              About
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: '#a89ec4' }}>
              Built with ❤️ for curious minds
            </p>
            {/* Social placeholder icons */}
            <div className="flex gap-3 mt-1" aria-label="Social links (coming soon)">
              {[
                { label: 'GitHub', icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                )},
                { label: 'Twitter/X', icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                )},
                { label: 'Discord', icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                  </svg>
                )},
              ].map(({ label, icon }) => (
                <span
                  key={label}
                  title={`${label} (coming soon)`}
                  className="flex h-8 w-8 cursor-default items-center justify-center rounded-button transition-colors"
                  style={{ color: 'rgba(168,158,196,0.5)', background: 'rgba(255,255,255,0.05)' }}
                  aria-label={`${label} — coming soon`}
                >
                  {icon}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-8 pt-6 flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between"
          style={{ borderTop: '1px solid rgba(167,139,250,0.12)' }}
        >
          <p className="text-xs" style={{ color: 'rgba(168,158,196,0.5)' }}>
            © {new Date().getFullYear()} Math Buddy. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: 'rgba(168,158,196,0.4)' }}>
            Powered by Gemini 2.0 Flash via OpenRouter
          </p>
        </div>
      </div>
    </footer>
  )
}
