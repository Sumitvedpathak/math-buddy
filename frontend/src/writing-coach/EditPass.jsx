import { useState } from 'react'
import { btn } from './Start'

export const COPS = [
  ['Capitals', 'Names of people, places, nations and peoples, treaties, events and book titles. Every sentence start, and the word I.'],
  ['Overall', 'Complete sentences (no fragments or run-ons), 5 to 7 of them, that make sense together.'],
  ['Punctuation', 'End marks, a comma after words like However, apostrophes, and quotation marks around quotes.'],
  ['Spelling', 'Subject words, names and tricky words. Check each one.'],
]

/** Before the photo: reread the paper once, only for conventions, and fix mistakes in pen. */
export default function EditPass({ topErrors, onDone }) {
  const [ticked, setTicked] = useState(() => COPS.map(() => false))

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">/ Edit pass</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink">Check your paper with COPS</h1>
        <p className="mt-3 text-ink-soft">
          Reread your paper once, only for mistakes in the way it is written. Fix them in pen on the paper.
          Then take your photo.
        </p>
      </header>

      {topErrors?.length > 0 && (
        <section className="rounded-2xl bg-card ring-soft p-6" aria-label="Your top errors">
          <h2 className="font-display text-lg font-semibold text-ink">Your usual mistakes</h2>
          <ul className="mt-3 list-disc pl-5 text-ink-soft">
            {topErrors.map((e) => <li key={e.category}>{e.label}</li>)}
          </ul>
        </section>
      )}

      <section className="rounded-2xl bg-card ring-soft p-6" aria-label="COPS checklist">
        <ul className="space-y-4 list-none p-0">
          {COPS.map(([name, hint], i) => (
            <li key={name}>
              <label className="flex gap-3 cursor-pointer items-start">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
                  checked={ticked[i]}
                  onChange={(e) => setTicked((t) => t.map((v, j) => (j === i ? e.target.checked : v)))}
                />
                <span>
                  <span className="font-semibold text-ink">{name[0]}</span>
                  <span className="font-semibold text-ink">{name.slice(1)}</span>
                  <span className="block text-ink-soft">{hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <button type="button" className={btn} disabled={!ticked.every(Boolean)} onClick={onDone}>
        I fixed my paper. Take a photo
      </button>
    </div>
  )
}
