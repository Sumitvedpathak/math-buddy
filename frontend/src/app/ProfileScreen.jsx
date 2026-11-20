import LinkCodeForm from './LinkCodeForm'

/**
 * Shown when this browser is not linked to a child: the child types the code a parent
 * made on /parent. (The full start screen with "I'm a parent / I'm a kid" comes next.)
 */
export default function ProfileScreen() {
  return (
    <main className="mx-auto max-w-xl px-6 py-12 md:py-16">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">/ Who&apos;s practising?</p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl font-semibold text-ink">Link this device</h1>
        <p className="mt-3 text-ink-soft">
          Ask your parent for a code. They make it on their Math Buddy page.
        </p>
      </header>

      <LinkCodeForm />

      <p className="mt-6 text-center text-sm text-ink-soft">
        Parent?{' '}
        <a href="/parent" className="underline hover:text-ink">Sign in with Google</a>
      </p>
    </main>
  )
}
