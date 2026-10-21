import { useState } from 'react'
import { useSession } from '../context/SessionContext'

const GRADES = [
  { id: '6', title: 'Grade 6', subtitle: 'Junior Explorer' },
  { id: '7', title: 'Grade 7', subtitle: 'Senior Champion + curriculum' },
]

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default function ProfileScreen() {
  const { findProfile, registerProfile, enterProfile } = useSession()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [grade, setGrade] = useState('7')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [confirmCreate, setConfirmCreate] = useState(false)

  const trimmedEmail = email.trim()
  const trimmedName = displayName.trim()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!EMAIL_RE.test(trimmedEmail)) {
      setMessage('Please enter a valid email address.')
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const profile = await findProfile(trimmedEmail)
      if (profile) {
        await enterProfile(profile)
      } else {
        // Never create silently — a typo must not spawn a phantom profile.
        setConfirmCreate(true)
      }
    } catch (err) {
      console.error('[profile lookup] error:', err)
      setMessage('Could not reach Math Buddy. Please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreate() {
    setBusy(true)
    setMessage(null)
    try {
      const profile = await registerProfile({ email: trimmedEmail, displayName: trimmedName, grade })
      setConfirmCreate(false)
      await enterProfile(profile)
    } catch (err) {
      console.error('[profile create] error:', err)
      setConfirmCreate(false)
      setMessage(
        err?.message?.includes('409')
          ? 'That email already has a profile — try again to sign in.'
          : 'Could not create the profile. Please try again.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12 md:py-16">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">/ Who&apos;s practising?</p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl font-semibold text-ink">Find your profile</h1>
        <p className="mt-3 text-ink-soft">
          Enter your email to pick up where you left off, or to start a new profile.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="rounded-2xl bg-card ring-soft p-6 md:p-8 space-y-6" noValidate>
        <div>
          <label htmlFor="profile-email" className="block text-sm font-medium text-ink">Email</label>
          <input
            id="profile-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div>
          <label htmlFor="profile-name" className="block text-sm font-medium text-ink">Name</label>
          <input
            id="profile-name"
            type="text"
            autoComplete="given-name"
            maxLength={80}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <p className="mt-1 text-xs text-muted-foreground">Only needed the first time.</p>
        </div>

        <fieldset>
          <legend className="block text-sm font-medium text-ink">Grade</legend>
          <div className="mt-2 grid sm:grid-cols-2 gap-3">
            {GRADES.map((g) => {
              const active = grade === g.id
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setGrade(g.id)}
                  className={[
                    'text-left rounded-xl border p-4 transition-all',
                    active
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border bg-surface hover:border-ink/20',
                  ].join(' ')}
                >
                  <span className="font-display text-lg font-semibold text-ink">{g.title}</span>
                  <p className="mt-1 text-xs text-ink-soft">{g.subtitle}</p>
                </button>
              )
            })}
          </div>
        </fieldset>

        {message && (
          <p role="alert" className="text-sm text-destructive">{message}</p>
        )}

        <button
          type="submit"
          disabled={busy || !trimmedEmail}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground ring-soft-lg transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? 'Checking…' : 'Continue'}
          <span aria-hidden="true">→</span>
        </button>
      </form>

      {confirmCreate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-profile-title"
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-card ring-soft-lg p-7">
            <h2 id="create-profile-title" className="font-display text-2xl font-semibold text-ink">
              No profile found
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              No profile found for <strong className="text-ink">{trimmedEmail}</strong> — check it again,
              or create a new profile?
            </p>
            {!trimmedName && (
              <p role="alert" className="mt-3 text-xs text-destructive">
                Add your name above first, then create the profile.
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmCreate(false)}
                className="rounded-md px-4 py-2 text-sm text-ink-soft hover:bg-muted"
              >
                Check email again
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={busy || !trimmedName}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Create new profile
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
