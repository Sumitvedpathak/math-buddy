import { useEffect, useState } from 'react'
import { btn, btnGhost } from './Start'
import { QuestionCard } from './QuestionDecode'

export function formatClock(totalSeconds) {
  const s = Math.max(0, totalSeconds)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Step 4 (and the rewrite): big timer, question on screen, write on paper. */
export default function WriteStep({ session, kind, minutes, feedback, onDone }) {
  const [remaining, setRemaining] = useState(minutes * 60)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000)
    return () => clearInterval(id)
  }, [running])

  const isRewrite = kind === 'rewrite'
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          / {isRewrite ? 'Rewrite one level higher' : 'Plan and write on paper'}
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink">
          {isRewrite ? 'Rewrite your answer' : 'Write your answer'}
        </h1>
        <p className="mt-3 text-ink-soft">
          Put today&apos;s date and the question title at the top of your page.
          {isRewrite && ' Add only what your feedback asked for.'}
        </p>
      </header>

      <section className="rounded-2xl bg-card ring-soft p-8 text-center" aria-label="Timer">
        <p
          className={`font-mono text-7xl font-semibold ${remaining === 0 ? 'text-destructive' : 'text-ink'}`}
          role="timer"
          aria-live="off"
        >
          {formatClock(remaining)}
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button type="button" className={btn} onClick={() => setRunning((r) => !r)}>
            {running ? 'Pause' : remaining === minutes * 60 ? 'Start timer' : 'Resume'}
          </button>
          <button type="button" className={btnGhost} onClick={() => { setRunning(false); setRemaining(minutes * 60) }}>
            Reset
          </button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{minutes} minutes. Stopping early is fine.</p>
      </section>

      {isRewrite && feedback && (
        <section className="rounded-2xl bg-card ring-soft p-6" aria-label="Your feedback">
          <h2 className="font-display text-lg font-semibold text-ink">Your feedback to use</h2>
          <ul className="mt-3 list-disc pl-5 text-ink-soft">
            {feedback.nextSteps.map((s) => <li key={s}>{s}</li>)}
          </ul>
          {feedback.pushQuestion && <p className="mt-3 text-ink"><strong>Push yourself:</strong> {feedback.pushQuestion}</p>}
        </section>
      )}

      <QuestionCard item={session.item} />

      <button type="button" className={btn} onClick={onDone}>I have finished writing. Take a photo</button>
    </div>
  )
}
