import { useSession } from '../context/SessionContext'
import LinkCodeForm from './LinkCodeForm'

/**
 * The way in for a browser that is not signed in: a kid types the code from a parent,
 * a parent goes to their sign-in page (/parent).
 */
export default function StartScreen() {
  const { state } = useSession()

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 md:py-16">
      <header className="mb-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">/ Welcome to Math Buddy</p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl font-semibold text-ink">Who&apos;s here?</h1>
      </header>

      {state.signedOut && (
        <p
          role="status"
          className="mx-auto mb-6 max-w-xl rounded-lg border border-border bg-surface px-4 py-3 text-center text-sm text-ink"
        >
          You&apos;ve been signed out on this device. Ask your parent for a new code.
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="start-kid" className="space-y-3">
          <h2 id="start-kid" className="font-display text-2xl font-semibold text-ink">I&apos;m a kid</h2>
          <p className="text-sm text-ink-soft">Type the code your parent made for you. You only do this once on this device.</p>
          <LinkCodeForm />
        </section>

        <section aria-labelledby="start-parent" className="space-y-3">
          <h2 id="start-parent" className="font-display text-2xl font-semibold text-ink">I&apos;m a parent</h2>
          <p className="text-sm text-ink-soft">Add your children and link their devices.</p>
          <div className="rounded-2xl bg-card ring-soft p-6 md:p-8 space-y-4">
            <p className="text-sm text-ink">
              Sign in with your Google account. You&apos;ll get a code for each child&apos;s device.
            </p>
            <a
              href="/parent"
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground ring-soft-lg transition-opacity hover:opacity-90"
            >
              Sign in with Google
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}
