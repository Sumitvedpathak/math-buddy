import { useSession } from '../context/SessionContext'

const PRINCIPLES = [
  { t: 'Working over answers.',  d: 'Sketching the steps matters more than the final number.' },
  { t: 'Kindness in feedback.',  d: 'Wrong answers get encouragement, not punishment.' },
  { t: 'Quiet by design.',       d: 'No notifications, no urgency. Show up when you\'re ready.' },
  { t: 'Built to grow.',         d: 'Today: maths for 9–12. Tomorrow: every subject, every age.' },
]

const ROADMAP = [
  { s: 'Now', t: 'Maths · ages 9–12',         c: 'available' },
  { s: 'Q2',  t: 'Maths · ages 13–16',         c: 'in progress' },
  { s: 'Q3',  t: 'Science & physics tracks',    c: 'planned' },
  { s: 'Q4',  t: 'Teacher dashboards',          c: 'planned' },
]

export default function About() {
  const { navigateTo } = useSession()

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 md:py-24">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">/ About</p>
      <h1 className="mt-3 font-display text-5xl md:text-6xl font-semibold text-ink leading-[1.05]">
        We&apos;re building the practice studio we wished we had.
      </h1>

      <p className="mt-8 text-lg text-ink-soft leading-relaxed max-w-2xl">
        Math Buddy is a quiet, focused space for learners to do the one thing that
        actually builds mathematical confidence — repeated, intentional practice. No
        ads, no streak shaming, no dark patterns. Just maths.
      </p>

      <section className="mt-16 grid md:grid-cols-2 gap-10">
        {/* Principles */}
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Our principles</h2>
          <ul className="mt-5 space-y-4 text-ink-soft">
            {PRINCIPLES.map(({ t, d }) => (
              <li key={t}>
                <strong className="block text-ink font-display text-base">{t}</strong>
                <span className="text-sm">{d}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Roadmap */}
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">What&apos;s next</h2>
          <ul className="mt-5 space-y-3">
            {ROADMAP.map((r) => (
              <li
                key={r.t}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3"
              >
                <div>
                  <span className="font-mono text-xs text-primary">{r.s}</span>
                  <p className="font-display text-base font-semibold text-ink leading-tight">{r.t}</p>
                </div>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  r.c === 'available'
                    ? 'bg-success/15 text-success'
                    : 'bg-muted text-ink-soft'
                }`}>
                  {r.c}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <div className="mt-20 rounded-2xl bg-primary text-primary-foreground p-10">
        <h2 className="font-display text-3xl font-semibold">Try it for yourself.</h2>
        <p className="mt-2 text-primary-foreground/80">One practice set. Less than a minute to set up.</p>
        <button
          type="button"
          onClick={() => navigateTo('practice')}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90"
          aria-label="Start practising"
        >
          Start practising →
        </button>
      </div>
    </div>
  )
}
