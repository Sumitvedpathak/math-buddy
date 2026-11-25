import { useCallback, useEffect, useState } from 'react'
import { ConsentRequiredError, refreshSession, signInWithGoogle, signOut } from '../../lib/auth'
import { theme, setTheme } from '../../themes/dandysWorld'
import ChildrenSection from './ChildrenSection'
import GoogleButton from './GoogleButton'

/** /parent is its own page (like /admin/<token>), separate from the child app for now. */
export function isParentPath(pathname) {
  return /^\/parent\/?$/.test(pathname)
}

export default function ParentApp() {
  const [status, setStatus] = useState('loading') // loading | signedOut | signedIn
  const [me, setMe] = useState(null)
  const [pendingIdToken, setPendingIdToken] = useState(null) // new parent, waiting for consent
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    setTheme(theme)
  }, [])

  // Still signed in from before? The refresh cookie answers that.
  useEffect(() => {
    let cancelled = false
    refreshSession()
      .then((result) => {
        if (cancelled) return
        setMe(result)
        setStatus(result ? 'signedIn' : 'signedOut')
      })
      .catch(() => !cancelled && setStatus('signedOut'))
    return () => {
      cancelled = true
    }
  }, [])

  const finishSignIn = useCallback(async (idToken, acceptedTerms) => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await signInWithGoogle(idToken, { acceptedTerms })
      setPendingIdToken(null)
      setMe(result)
      setStatus('signedIn')
    } catch (err) {
      if (err instanceof ConsentRequiredError) {
        setPendingIdToken(idToken)
      } else {
        console.error('[parent sign-in] error:', err)
        setPendingIdToken(null)
        setMessage('We could not sign you in. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }, [])

  const handleCredential = useCallback((idToken) => finishSignIn(idToken, false), [finishSignIn])

  async function handleSignOut() {
    setBusy(true)
    try {
      await signOut()
    } finally {
      setBusy(false)
      setMe(null)
      setAgreed(false)
      setStatus('signedOut')
    }
  }

  return (
    <div id="theme-root" className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-xl px-6 py-12 md:py-16">
        <header className="mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">/ Parents</p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl font-semibold text-ink">Math Buddy for parents</h1>
        </header>

        {status === 'loading' && <p className="text-ink-soft">Loading…</p>}

        {status === 'signedOut' && (
          <section className="rounded-2xl bg-card ring-soft p-6 md:p-8 space-y-6">
            {!pendingIdToken ? (
              <>
                <p className="text-ink-soft">
                  Sign in with your Google account to set up your children and their devices.
                </p>
                <GoogleButton onCredential={handleCredential} />
              </>
            ) : (
              <div className="space-y-5">
                <h2 className="font-display text-2xl font-semibold text-ink">Create your parent account</h2>
                <label className="flex items-start gap-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-primary"
                  />
                  <span>
                    I am the parent or legal guardian and agree to the Terms and Privacy Policy
                    <span className="text-muted-foreground"> (draft)</span>.
                  </span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!agreed || busy}
                    onClick={() => finishSignIn(pendingIdToken, true)}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground ring-soft-lg transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {busy ? 'Creating…' : 'Create my account'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingIdToken(null)
                      setAgreed(false)
                    }}
                    className="rounded-md px-4 py-2 text-sm text-ink-soft hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {message && (
              <p role="alert" className="text-sm text-destructive">{message}</p>
            )}
          </section>
        )}

        {status === 'signedIn' && me && (
          <section className="rounded-2xl bg-card ring-soft p-6 md:p-8 space-y-6">
            <div>
              <p className="text-sm text-muted-foreground">Signed in as</p>
              <p className="mt-1 font-display text-2xl font-semibold text-ink">{me.parent.display_name}</p>
              <p className="text-sm text-ink-soft">{me.parent.email}</p>
            </div>
            <ChildrenSection initialChildren={me.children ?? []} />
            <button
              type="button"
              disabled={busy}
              onClick={handleSignOut}
              className="rounded-md border border-border px-4 py-2 text-sm text-ink hover:bg-muted disabled:opacity-40"
            >
              Sign out
            </button>
          </section>
        )}

        <p className="mt-8 text-sm">
          <a href="/" className="text-ink-soft underline hover:text-ink">← Back to Math Buddy</a>
        </p>
      </main>
    </div>
  )
}
