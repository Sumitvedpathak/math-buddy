import { useState } from 'react'
import { useSession } from '../context/SessionContext'

/** "Have a code from your parent?" — links this browser to the child the code was made for. */
export default function LinkCodeForm() {
  const { linkWithCode } = useSession()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await linkWithCode(code.trim())
    } catch (err) {
      console.error('[link code] error:', err)
      if (err?.status === 401) {
        setMessage("That code didn't work. Check it, or ask your parent for a new one.")
      } else if (err?.status === 429) {
        setMessage('Too many tries. Please wait a few minutes and try again.')
      } else {
        setMessage('Could not reach Math Buddy. Please check your connection and try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-card ring-soft p-6 md:p-8 space-y-4" noValidate>
      <div>
        <label htmlFor="link-code" className="block text-sm font-medium text-ink">
          Code from your parent
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Your parent makes it on their Math Buddy page. It looks like 7K4Q-9PXM.
        </p>
        <input
          id="link-code"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={12}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mt-3 w-full rounded-lg border border-border bg-surface px-4 py-3 font-mono text-lg tracking-[0.2em] uppercase text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      {message && (
        <p role="alert" className="text-sm text-destructive">{message}</p>
      )}
      <button
        type="submit"
        disabled={busy || !code.trim()}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? 'Checking…' : 'Use code'}
      </button>
    </form>
  )
}
