import { useState } from 'react'
import { SUBJECT_LABEL } from './colours'

export const CRITERIA = [
  'I will read the question twice, circle the command word (Describe, Explain, Compare, Analyse, Evaluate, Justify) and count how many parts I must answer.',
  'Restate: I will turn the question into my first sentence.',
  'Answer: I will give a clear, specific claim that answers EVERY part.',
  'Cite: I will use at least 2 specific pieces of evidence (names, dates, numbers, quotes with page numbers).',
  'Explain: after each piece of evidence, I will explain how it proves my point ("This shows that…").',
  'Extend (Level 4): I will add one deeper idea: another group\'s perspective, a link to today, short- versus long-term effects, or the author\'s choice and why.',
  'I will use at least 2 subject words (for example Loyalist, seigneury, treaty, theme, symbol).',
  'I will aim for 150 to 250 words and check my work against this list before I submit.',
  'Before I take my photo I will reread my paper once for COPS (Capitals, Overall, Punctuation, Spelling) and fix mistakes in pen.',
]

export const btn =
  'inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground ring-soft-lg transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed'
export const btnGhost =
  'inline-flex items-center justify-center rounded-md border border-border px-5 py-2.5 text-sm font-medium text-ink hover:bg-muted transition-colors disabled:opacity-40'

const STAGE_LABEL = {
  question: 'Answer not written yet',
  draft_check: 'Check the text and mark it',
  draft_report: 'See your report, then rewrite',
  rewrite_check: 'Check your rewrite and mark it',
  rewrite_report: 'See your rewrite report and the model answer',
}

const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

function ContinueCard({ unfinished, onContinue, busy }) {
  return (
    <section className="rounded-2xl bg-card ring-soft p-6" aria-label="Continue where you left off">
      <h2 className="font-display text-xl font-semibold text-ink">Continue where you left off</h2>
      <ul className="mt-4 divide-y divide-border list-none p-0">
        {unfinished.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0 flex-1 basis-64">
              <p className="font-mono text-xs text-muted-foreground">
                {dateFmt.format(new Date(u.created_at))} · {SUBJECT_LABEL[u.subject]}
              </p>
              <p className="mt-1 text-ink">{u.question}</p>
              <p className="mt-1 text-sm text-ink-soft">{STAGE_LABEL[u.stage]}</p>
            </div>
            <button type="button" className={btnGhost} disabled={busy} onClick={() => onContinue(u.id)}>
              Continue
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function Start({ reminder, onBegin, onHistory, onContinue, busy }) {
  const [subject, setSubject] = useState(reminder.suggested_subject)
  const [schoolQuestion, setSchoolQuestion] = useState('')
  const [ticked, setTicked] = useState(() => CRITERIA.map(() => false))
  const allTicked = ticked.every(Boolean)
  const needsQuestion = subject === 'school' && !schoolQuestion.trim()

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">/ Writing Coach</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink">Before you start</h1>
        <p className="mt-3 text-ink-soft">Tick each one to unlock a new question.</p>
      </header>

      {reminder.unfinished?.length > 0 && (
        <ContinueCard unfinished={reminder.unfinished} onContinue={onContinue} busy={busy} />
      )}

      <section className="rounded-2xl bg-card ring-soft p-6 space-y-3" aria-label="This week">
        <h2 className="font-display text-xl font-semibold text-ink">
          Week {reminder.focus_week} focus: {reminder.focus_title}
        </h2>
        <p className="text-ink-soft">{reminder.focus_text}</p>
        {reminder.last_next_time && (
          <p className="text-ink">
            <span className="font-mono text-xs uppercase text-muted-foreground">Last time you said you would</span>
            <br />“{reminder.last_next_time}”
          </p>
        )}
      </section>

      {reminder.top_errors?.length > 0 && (
        <section className="rounded-2xl bg-card ring-soft p-6" aria-label="Your top errors">
          <h2 className="font-display text-xl font-semibold text-ink">Watch for these today</h2>
          <ul className="mt-3 list-disc pl-5 text-ink-soft">
            {reminder.top_errors.map((e) => (
              <li key={e.category}>
                In your last {reminder.top_errors_sessions} practices you missed <strong className="text-ink">{e.label}</strong> {e.count} times.
              </li>
            ))}
          </ul>
        </section>
      )}

      {reminder.rubric_override && (
        <section className="rounded-2xl bg-card ring-soft p-6" aria-label="Teacher success criteria">
          <h2 className="font-display text-xl font-semibold text-ink">Your teacher&apos;s success criteria</h2>
          <p className="mt-3 whitespace-pre-wrap text-ink-soft">{reminder.rubric_override}</p>
        </section>
      )}

      <section className="rounded-2xl bg-card ring-soft p-6" aria-label="Success criteria">
        <h2 className="font-display text-xl font-semibold text-ink">My success criteria</h2>
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
      </section>

      <section className="rounded-2xl bg-card ring-soft p-6 space-y-4" aria-label="Choose a subject">
        <h2 className="font-display text-xl font-semibold text-ink">Today&apos;s practice</h2>
        {reminder.is_rest_day && <p className="text-ink-soft">Sunday is a rest day. Practice is optional.</p>}
        <div role="radiogroup" aria-label="Subject" className="flex flex-wrap gap-2">
          {['history', 'language', 'school'].map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={subject === s}
              onClick={() => setSubject(s)}
              className={`rounded-md border px-4 py-2 text-sm font-medium ${
                subject === s ? 'border-primary bg-primary/10 text-ink' : 'border-border text-ink-soft hover:bg-muted'
              }`}
            >
              {SUBJECT_LABEL[s]}
              {s === reminder.suggested_subject && !reminder.is_rest_day && (
                <span className="ml-2 text-xs text-muted-foreground">today</span>
              )}
            </button>
          ))}
        </div>
        {subject === 'school' && (
          <div>
            <label htmlFor="school-question" className="block text-sm text-ink">Type the question from school</label>
            <textarea
              id="school-question"
              rows={3}
              maxLength={1500}
              value={schoolQuestion}
              onChange={(e) => setSchoolQuestion(e.target.value)}
              className="mt-2 w-full rounded-md border border-border bg-background p-3 text-ink"
            />
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={btn}
          disabled={!allTicked || needsQuestion || busy}
          onClick={() => onBegin(subject, schoolQuestion.trim())}
        >
          {busy ? 'Getting your question…' : 'Show my question'}
        </button>
        <button type="button" className={btnGhost} onClick={onHistory}>My results</button>
        {!allTicked && <span className="text-sm text-muted-foreground">Tick all {CRITERIA.length} to continue.</span>}
      </div>
    </div>
  )
}
