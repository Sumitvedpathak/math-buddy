import { useState } from 'react'
import { btn } from './Start'

/** Steps 9 and 10: the Level 4 model answer, one move he did not make, and his goal. */
export default function WrapUp({ model, onFinish, busy, error }) {
  const [move, setMove] = useState('')
  const [nextTime, setNextTime] = useState('')

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">/ Level 4 model answer</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink">See how a Level 4 answer works</h1>
        <p className="mt-3 text-ink-soft">Read it, then name one move it makes that you did not. Do not copy it.</p>
      </header>

      <section className="rounded-2xl bg-card ring-soft p-6" aria-label="Model answer">
        <p className="whitespace-pre-wrap leading-relaxed text-ink">{model.model_answer}</p>
        <h2 className="mt-5 font-display text-lg font-semibold text-ink">Ideas to go deeper</h2>
        <ul className="mt-2 list-disc pl-5 text-ink-soft">{model.extend_hints.map((h) => <li key={h}>{h}</li>)}</ul>
      </section>

      <section className="rounded-2xl bg-card ring-soft p-6 space-y-5" aria-label="Your goal">
        <div>
          <label htmlFor="wc-move" className="block text-ink">One move the model answer makes that I did not</label>
          <textarea id="wc-move" rows={2} maxLength={500} value={move} onChange={(e) => setMove(e.target.value)}
            className="mt-2 w-full rounded-md border border-border bg-background p-3 text-ink" />
        </div>
        <div>
          <label htmlFor="wc-next" className="block text-ink">One thing I will do next time</label>
          <textarea id="wc-next" rows={2} maxLength={500} value={nextTime} onChange={(e) => setNextTime(e.target.value)}
            className="mt-2 w-full rounded-md border border-border bg-background p-3 text-ink" />
        </div>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <button type="button" className={btn} disabled={busy || !move.trim() || !nextTime.trim()}
          onClick={() => onFinish({ next_time: nextTime.trim(), model_move: move.trim() })}>
          Save and finish
        </button>
      </section>
    </div>
  )
}
