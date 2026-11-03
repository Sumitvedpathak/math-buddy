import { useState } from 'react'
import { btn, CRITERIA } from './Start'
import { QuestionCard } from './QuestionDecode'

/** Step 4 (and the rewrite): the question and his success criteria on screen while he writes on paper. */
export default function WriteStep({ session, kind, feedback, onDone }) {
  // Self-check ticks only; nothing here is required to continue.
  const [ticked, setTicked] = useState(() => CRITERIA.map(() => false))
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

      <QuestionCard item={session.item} />

      <details open className="rounded-2xl bg-card ring-soft p-6 group" aria-label="My success criteria">
        <summary className="cursor-pointer list-none font-display text-xl font-semibold text-ink flex items-center justify-between">
          My success criteria
          <span className="text-sm font-normal text-muted-foreground group-open:hidden">Tap to open</span>
          <span className="text-sm font-normal text-muted-foreground hidden group-open:inline">Tap to close</span>
        </summary>
        <ul className="mt-4 space-y-3 list-none p-0">
          {CRITERIA.map((text, i) => (
            <li key={text}>
              <label className="flex gap-3 cursor-pointer items-start text-ink-soft">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
                  checked={ticked[i]}
                  onChange={(e) => setTicked((t) => t.map((v, j) => (j === i ? e.target.checked : v)))}
                />
                <span>{text}</span>
              </label>
            </li>
          ))}
        </ul>
      </details>

      {isRewrite && feedback && (
        <section className="rounded-2xl bg-card ring-soft p-6" aria-label="Your feedback">
          <h2 className="font-display text-lg font-semibold text-ink">Your feedback to use</h2>
          <ul className="mt-3 list-disc pl-5 text-ink-soft">
            {feedback.nextSteps.map((s) => <li key={s}>{s}</li>)}
          </ul>
          {feedback.pushQuestion && <p className="mt-3 text-ink"><strong>Push yourself:</strong> {feedback.pushQuestion}</p>}
        </section>
      )}

      <button type="button" className={btn} onClick={onDone}>I have finished writing. Take a photo</button>
    </div>
  )
}
