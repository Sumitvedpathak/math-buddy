import { useSession } from '../context/SessionContext'

const TRACKS = [
  { n: '01', t: 'Vedic Maths',     d: 'Ancient mental-arithmetic techniques that turn slow sums into instant answers.',    g: 'from-primary/30 to-transparent' },
  { n: '02', t: 'Word Problems',   d: 'Translate real-world stories into the maths underneath. Reasoning over recall.',     g: 'from-accent/30 to-transparent' },
  { n: '03', t: 'Algebra',         d: 'Unknowns, equations and the leap from arithmetic to mathematical thinking.',          g: 'from-success/20 to-transparent' },
  { n: '04', t: 'Volumes & Shapes',d: 'Spatial reasoning in three dimensions — cubes, prisms, pyramids and more.',           g: 'from-destructive/20 to-transparent' },
]

const STEPS = [
  { n: '01', t: 'Configure your set',  d: 'Pick an age group, choose your topics, set how many questions you want.' },
  { n: '02', t: 'Solve your way',      d: 'Sketch the working on a digital scratchpad, or type the final answer.' },
  { n: '03', t: 'Review, then refine', d: 'Get the correct answer with a kind, encouraging note — and try again.' },
]

const STATS = [
  { k: '4',    v: 'Topic tracks' },
  { k: '100+', v: 'Questions / set' },
  { k: '2',    v: 'Answer modes' },
]

export default function HomeScreen() {
  const { navigateTo } = useSession()

  return (
    <main>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-glow pointer-events-none" aria-hidden="true" />
        <div className="absolute inset-0 grid-paper opacity-40 pointer-events-none" aria-hidden="true" />
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl animate-float-slow pointer-events-none" aria-hidden="true" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-accent/20 blur-3xl animate-float-slow pointer-events-none" aria-hidden="true" style={{ animationDelay: '2s' }} />

        <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-28">
          <div className="grid lg:grid-cols-12 gap-12 items-center">

            {/* Left — copy */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 backdrop-blur px-3 py-1 text-xs font-medium text-ink-soft">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                </span>
                <span className="text-ink">Live</span>
                <span className="h-3 w-px bg-border" />
                Built for ages 9–12 · expanding fast
              </div>

              <h1 className="mt-6 font-display text-5xl md:text-6xl lg:text-7xl font-semibold leading-[0.98] text-ink">
                Maths that hits<br />
                <span className="text-gradient-primary">different.</span>
              </h1>

              <p className="mt-6 text-lg text-ink-soft max-w-xl leading-relaxed">
                The practice studio your kid won&apos;t put down. Vedic shortcuts, word problems,
                algebra and volumes — sketched or typed, instantly reviewed.
                Built to make brains light up.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigateTo('practice')}
                  className="group inline-flex items-center gap-2 rounded-full bg-gradient-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground glow-primary hover:scale-[1.02] transition-transform"
                  aria-label="Start a practice set"
                >
                  Start a practice set
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo('about')}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 backdrop-blur px-6 py-3.5 text-sm font-medium text-ink hover:bg-surface-elevated hover:border-primary/40 transition-colors"
                >
                  How it works
                </button>
              </div>

              {/* Stat counters */}
              <dl className="mt-12 grid grid-cols-3 gap-6 max-w-md">
                {STATS.map((s) => (
                  <div key={s.v} className="border-l border-border pl-4">
                    <dt className="font-display text-3xl font-semibold text-ink">{s.k}</dt>
                    <dd className="mt-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{s.v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Right — sample question card */}
            <div className="lg:col-span-5">
              <div className="relative">
                <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-primary/30 via-accent/20 to-transparent blur-2xl pointer-events-none" />
                <div className="relative rounded-2xl bg-card/80 backdrop-blur-xl ring-soft-lg p-7 noise-overlay overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary border border-primary/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      Vedic Maths · 01
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">00:42</span>
                  </div>
                  <p className="mt-6 font-display text-2xl leading-snug text-ink">
                    Multiply <span className="text-accent">2345 × 11</span> using the Vedic shortcut.
                  </p>
                  <div className="mt-6 rounded-lg bg-background/60 p-4 border border-border">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2">Your working</p>
                    <p className="font-mono text-sm text-ink-soft leading-relaxed">
                      2_3_4_5 → 2·(2+3)·(3+4)·(4+5)·5<br />
                      = 2·5·7·9·5<br />
                      = <span className="text-success font-semibold">25 795</span>
                    </p>
                  </div>
                  <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      Sketch or type · auto-saved
                    </span>
                    <span className="font-mono text-success">+25 XP</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRACKS ── */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">/ Tracks</p>
              <h2 className="mt-3 font-display text-4xl md:text-5xl font-semibold text-ink">Four foundations.</h2>
              <p className="mt-2 text-ink-soft max-w-lg">
                Each track is engineered to build a specific kind of mathematical confidence.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('practice')}
              className="text-sm font-medium text-primary hover:text-accent transition-colors"
            >
              Browse all tracks →
            </button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TRACKS.map((c) => (
              <article
                key={c.t}
                className="group relative rounded-2xl bg-card ring-soft p-6 overflow-hidden transition-all hover:-translate-y-1 hover:ring-soft-lg"
              >
                <div className={`absolute -top-16 -right-16 h-40 w-40 rounded-full bg-gradient-to-br ${c.g} blur-2xl opacity-60 group-hover:opacity-100 transition-opacity`} />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">{c.n}</span>
                    <span className="h-8 w-8 rounded-full bg-muted grid place-items-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all group-hover:rotate-45">
                      →
                    </span>
                  </div>
                  <h3 className="mt-8 font-display text-xl font-semibold text-ink">{c.t}</h3>
                  <p className="mt-2 text-sm text-ink-soft leading-relaxed">{c.d}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">/ Method</p>
            <h2 className="mt-3 font-display text-4xl md:text-5xl font-semibold text-ink leading-tight">
              A simple loop.<br />
              <span className="text-gradient-primary">Repeated with intention.</span>
            </h2>
            <p className="mt-4 text-ink-soft">
              No streaks to defend. No coins to chase. Just a clean rhythm of
              practice, reflection and review — the way real mastery is built.
            </p>
          </div>

          <ol className="lg:col-span-8 space-y-3 list-none p-0">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="group grid grid-cols-[auto_1fr] gap-6 p-7 rounded-2xl bg-card ring-soft hover:ring-soft-lg transition-all"
              >
                <span className="font-display text-3xl text-gradient-primary font-semibold leading-none">{s.n}</span>
                <div>
                  <h3 className="font-display text-xl font-semibold text-ink">{s.t}</h3>
                  <p className="mt-1.5 text-sm text-ink-soft leading-relaxed">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-12 md:p-16 noise-overlay">
          <div className="absolute inset-0 grid-paper opacity-[0.08] pointer-events-none" aria-hidden="true" />
          <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-accent/40 blur-3xl pointer-events-none" />
          <div className="relative grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="font-display text-4xl md:text-5xl font-semibold leading-tight text-primary-foreground">
                Ready when you are.
              </h2>
              <p className="mt-4 text-primary-foreground/80 max-w-md">
                Your first practice set takes less than a minute to configure.
                And it&apos;s free, forever.
              </p>
            </div>
            <div className="md:justify-self-end">
              <button
                type="button"
                onClick={() => navigateTo('practice')}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-4 text-sm font-semibold text-accent-foreground glow-accent hover:scale-[1.03] transition-transform"
                aria-label="Begin practising"
              >
                Begin practising
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
