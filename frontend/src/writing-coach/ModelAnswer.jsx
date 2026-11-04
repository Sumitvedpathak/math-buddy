import { useState } from 'react'
import { wc } from './wcApi'
import { btnGhost } from './Start'

/** The Level 4 model answer, closed by default. It is written the first time he opens it. */
export default function ModelAnswer({ profileId, session }) {
  const [open, setOpen] = useState(false)
  const [answer, setAnswer] = useState(session.item.model_answer || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const m = await wc.modelAnswer(profileId, session.id)
      setAnswer(m.model_answer)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    if (!open && !answer && !loading) load()
    setOpen(!open)
  }

  return (
    <section className="rounded-2xl bg-card ring-soft p-6" aria-label="Model answer">
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 text-left font-display text-xl font-semibold text-ink"
      >
        Level 4 model answer
        <span className="text-sm font-normal text-muted-foreground">{open ? 'Tap to close' : 'Tap to open'}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-3">
          {loading && <p role="status" className="text-ink-soft">Writing the model answer…</p>}
          {error && (
            <>
              <p role="alert" className="text-destructive">{error}</p>
              <button type="button" className={btnGhost} onClick={load}>Try again</button>
            </>
          )}
          {answer && (
            <>
              <p className="text-sm text-ink-soft">See how a Level 4 answer works. Do not copy it.</p>
              <p className="whitespace-pre-wrap leading-relaxed text-ink">{answer}</p>
              <h3 className="font-display text-lg font-semibold text-ink">Ideas to go deeper</h3>
              <ul className="list-disc pl-5 text-ink-soft">
                {session.item.extend_hints.map((h) => <li key={h}>{h}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  )
}
