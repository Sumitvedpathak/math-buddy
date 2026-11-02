import { useEffect, useState } from 'react'
import { wc } from './wcApi'
import Report from './Report'
import { STEP_BY_KEY, SUBJECT_LABEL } from './colours'
import { btn, btnGhost } from './Start'

const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const fmt = (iso) => dateFmt.format(new Date(iso))
const levelText = (r) => (r ? `${r.level} (${r.percent}%)` : '—')

function Overview({ overview }) {
  if (!overview || overview.session_count === 0) {
    return <p className="text-ink-soft">Finish your first practice and your progress will show up here.</p>
  }
  const { steps, recent_count: recent } = overview
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-ink">Where you are lagging (your last {recent} {recent === 1 ? 'session' : 'sessions'})</h3>
        <ul className="mt-3 space-y-2 list-none p-0">
          {steps.map((s) => (
            <li key={s.step}>
              <div className="flex justify-between text-sm">
                <span className="text-ink">{STEP_BY_KEY[s.step].label}</span>
                <span className="font-mono text-ink-soft">
                  {s.average} / 2{s.missing_count > 0 && ` · missing in ${s.missing_count}`}
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full" style={{ width: `${(s.average / 2) * 100}%`, background: STEP_BY_KEY[s.step].border }} />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-ink-soft">
          Weakest first. <strong className="text-ink">{STEP_BY_KEY[steps[0].step].label}</strong> needs the most work.
        </p>
      </div>
      <ul className="list-disc pl-5 text-ink-soft space-y-1">
        {overview.sessions_with_missed_parts > 0 && (
          <li>You skipped part of the question in {overview.sessions_with_missed_parts} of your last {recent} sessions.</li>
        )}
        {overview.command_words_missed.length > 0 && (
          <li>Command words you decoded wrongly: {overview.command_words_missed.map(([w, n]) => `${w} (${n})`).join(', ')}.</li>
        )}
        {overview.average_word_count != null && (
          <li>Your drafts average {overview.average_word_count} words. The target is 150 to 250.</li>
        )}
      </ul>
      <div>
        <h3 className="font-semibold text-ink">Your level over time</h3>
        {['history', 'language', 'school'].map((subject) => {
          const rows = overview.timeline.filter((t) => t.subject === subject)
          if (rows.length === 0) return null
          return (
            <div key={subject} className="mt-3">
              <p className="text-sm text-ink">{SUBJECT_LABEL[subject]}</p>
              <div className="mt-1 flex items-end gap-2 h-24" aria-label={`${SUBJECT_LABEL[subject]} draft percentages`}>
                {rows.map((r) => (
                  <div key={r.date} className="flex flex-col items-center gap-1">
                    <span className="font-mono text-[10px] text-muted-foreground">{r.draft_percent}</span>
                    <div className="w-5 rounded-t bg-primary" style={{ height: `${Math.max(4, ((r.draft_percent - 40) / 60) * 64)}px` }} />
                    <span className="font-mono text-[10px] text-muted-foreground">{fmt(r.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        <p className="mt-2 text-sm text-ink-soft">Level 3 starts at 70%. Level 4 starts at 80%.</p>
      </div>
    </div>
  )
}

function SessionDetail({ profileId, row, onBack }) {
  const [report, setReport] = useState(null)
  const [kind, setKind] = useState('draft')
  const [error, setError] = useState(null)

  useEffect(() => {
    wc.report(profileId, row.id).then(setReport).catch((e) => setError(e.message))
  }, [profileId, row.id])

  if (error) return <p role="alert" className="text-destructive">{error}</p>
  if (!report) return <p className="text-ink-soft">Loading…</p>
  const hasRewrite = Boolean(report.submissions.rewrite?.review)
  const { session } = report
  return (
    <div className="space-y-6">
      <button type="button" className={btnGhost} onClick={onBack}>Back to my results</button>
      <section className="rounded-2xl bg-card ring-soft p-6">
        <p className="font-mono text-xs uppercase text-muted-foreground">{SUBJECT_LABEL[session.subject]} · {fmt(session.created_at)}</p>
        <p className="mt-2 font-display text-xl text-ink">{session.item.question}</p>
        {session.next_time && <p className="mt-3 text-ink-soft">Your goal: “{session.next_time}”</p>}
      </section>
      {hasRewrite && (
        <div role="tablist" className="flex gap-2">
          {['draft', 'rewrite'].map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
              className={`rounded-md border px-4 py-2 text-sm capitalize ${kind === k ? 'border-primary bg-primary/10 text-ink' : 'border-border text-ink-soft'}`}>
              {k}
            </button>
          ))}
        </div>
      )}
      <Report report={report} kind={hasRewrite ? kind : 'draft'} />
      {session.item.model_answer && (
        <section className="rounded-2xl bg-card ring-soft p-6">
          <h2 className="font-display text-xl font-semibold text-ink">Level 4 model answer</h2>
          <p className="mt-3 whitespace-pre-wrap text-ink-soft">{session.item.model_answer}</p>
          {session.model_move && <p className="mt-3 text-ink">A move you noticed: {session.model_move}</p>}
        </section>
      )}
    </div>
  )
}

export default function History({ profileId, onBack, onNew }) {
  const [rows, setRows] = useState(null)
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(null)

  useEffect(() => {
    Promise.all([wc.listSessions(profileId), wc.overview(profileId)])
      .then(([list, ov]) => { setRows(list); setOverview(ov) })
      .catch((e) => setError(e.message))
  }, [profileId])

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">/ Writing Coach</p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-ink">My results</h1>
        </div>
        <div className="flex gap-2">
          <button type="button" className={btn} onClick={onNew}>New practice</button>
          <button type="button" className={btnGhost} onClick={onBack}>Back</button>
        </div>
      </header>

      {error && <p role="alert" className="text-destructive">{error}</p>}
      {!rows && !error && <p className="text-ink-soft">Loading…</p>}

      {rows && open && <SessionDetail profileId={profileId} row={open} onBack={() => setOpen(null)} />}

      {rows && !open && (
        <>
          <section className="rounded-2xl bg-card ring-soft p-6" aria-label="Where you are lagging">
            <Overview overview={overview} />
          </section>
          <section className="rounded-2xl bg-card ring-soft p-6" aria-label="Past practice">
            <h2 className="font-display text-xl font-semibold text-ink">Past practice</h2>
            {rows.length === 0 ? (
              <p className="mt-3 text-ink-soft">Nothing yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-border list-none p-0">
                {rows.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => r.draft && setOpen(r)} disabled={!r.draft}
                      className="w-full py-3 text-left hover:bg-muted/40 disabled:opacity-60 disabled:cursor-default px-2 rounded">
                      <span className="font-mono text-xs text-muted-foreground">{fmt(r.created_at)} · {SUBJECT_LABEL[r.subject]}</span>
                      <span className="mt-1 block text-ink">{r.question}</span>
                      <span className="mt-1 block text-sm text-ink-soft">
                        Draft {levelText(r.draft)} · Rewrite {levelText(r.rewrite)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
