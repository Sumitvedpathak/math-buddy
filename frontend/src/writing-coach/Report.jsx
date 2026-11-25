import { CRITERIA_LABELS, STEPS, STEP_BY_KEY, colourSegments, missingSteps } from './colours'

const card = 'rounded-2xl bg-card ring-soft p-6'
const h2 = 'font-display text-xl font-semibold text-ink'

function Section({ title, children, label = undefined }) {
  return (
    <section className={card} aria-label={label || title}>
      <h2 className={h2}>{title}</h2>
      <div className="mt-4 space-y-3 text-ink-soft">{children}</div>
    </section>
  )
}

/** Meter from 0 to 100 with marks at the Level 3 (70%) and Level 4 (80%) lines. */
function LevelMeter({ percent }) {
  return (
    <div className="relative mt-2 h-3 rounded-full bg-muted" role="img" aria-label={`${percent} percent`}>
      <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${percent}%` }} />
      {[70, 80].map((mark) => (
        <div key={mark} className="absolute -top-1 -bottom-1 w-px bg-ink-soft" style={{ left: `${mark}%` }}>
          <span className="absolute top-5 -translate-x-1/2 font-mono text-[10px] text-muted-foreground">
            {mark}%
          </span>
        </div>
      ))}
    </div>
  )
}

function ResultCard({ title, review }) {
  return (
    <div className="flex-1 min-w-[12rem]">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
      <p className="mt-1 font-display text-5xl font-semibold text-ink">
        Level {review.level}
        <span className="ml-3 text-2xl text-ink-soft">{review.percent}%</span>
      </p>
      <LevelMeter percent={review.percent} />
    </div>
  )
}

const STATUS_TEXT = {
  fixed: { mark: '✓', text: 'Fixed', cls: 'text-accent' },
  still_there: { mark: '✗', text: 'Still there', cls: 'text-destructive' },
  rewritten: { mark: '~', text: 'Rewritten, so check it by eye', cls: 'text-ink-soft' },
}

/** The three rubric criteria side by side, each with its one next step. */
function CriteriaMarks({ criteria }) {
  const keys = Object.keys(CRITERIA_LABELS)
  const lowest = keys.reduce((a, b) => (criteria[b].percent < criteria[a].percent ? b : a))
  return (
    <section aria-label="Your three marks">
      <ul className="grid gap-3 sm:grid-cols-3 list-none p-0">
        {keys.map((key) => {
          const c = criteria[key]
          return (
            <li key={key} className={`rounded-xl bg-muted p-4 border ${key === lowest ? 'border-primary' : 'border-transparent'}`}>
              {key === lowest && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                  Work on this first
                </span>
              )}
              <h3 className="mt-2 font-semibold text-ink">{CRITERIA_LABELS[key]}</h3>
              <p className="font-display text-3xl font-semibold text-ink">
                {c.level}<span className="ml-2 text-base font-normal text-ink-soft">{c.percent}%</span>
              </p>
              {c.note && <p className="mt-2 text-sm">{c.note}</p>}
              <p className="mt-2 text-sm"><strong className="text-ink">Next step:</strong> {c.nextStep}</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function sentenceAdvice(count) {
  if (count < 5) return 'The target is 5 to 7, so add more.'
  if (count > 7) return 'The target is 5 to 7, so tighten it.'
  return 'That is in the 5 to 7 target.'
}

function YourSentences({ communication }) {
  const { sentenceCount: count, repeatedOpeners: openers } = communication
  return (
    <Section title="Your sentences">
      <ul className="list-disc pl-5">
        <li><strong className="text-ink">{count} {count === 1 ? 'sentence' : 'sentences'}.</strong> {sentenceAdvice(count)}</li>
        {openers.map((o) => (
          <li key={o}>Several sentences start with <strong className="text-ink">&ldquo;{o}&rdquo;</strong>. Try different openings.</li>
        ))}
      </ul>
    </Section>
  )
}

function ErrorList({ errors }) {
  return (
    <ul className="space-y-2 list-none p-0">
      {errors.map((e, i) => (
        <li key={`${e.original}-${i}`} className="rounded-xl bg-muted p-3">
          <p className="text-ink">
            <span className="line-through decoration-destructive">{e.original}</span>
            {' → '}
            <strong>{e.correction}</strong>
          </p>
          {e.rule && <p className="text-sm">{e.rule}</p>}
        </li>
      ))}
    </ul>
  )
}

/** Older reviews only: conventions came after elaboration and evidence. */
function ConventionsSection({ conventions, contentLevel, level }) {
  if (!conventions || Array.isArray(conventions) || conventions.score === undefined) return null
  const { score, errors } = conventions
  const effect = { 2: 'No change to your level.', 1: 'This lowered your level by one step.', 0: 'This lowered your level by two steps.' }[score]
  return (
    <Section title="Spelling, grammar and punctuation" label="Conventions">
      <p className="text-ink">
        Conventions score: <strong>{score}/2</strong>. {effect}
        {contentLevel && contentLevel !== level && ` Your ideas earned Level ${contentLevel}, so your level is ${level}.`}
      </p>
      {errors.length === 0 ? (
        <p>No mistakes found. Well done.</p>
      ) : (
        <>
          <h3 className="font-semibold text-ink">Fix these before you hand it in</h3>
          <ErrorList errors={errors} />
        </>
      )}
    </Section>
  )
}

function FixedErrors({ fixed }) {
  if (!fixed || fixed.length === 0) return null
  const done = fixed.filter((f) => f.status === 'fixed').length
  return (
    <Section title="Did you fix your draft mistakes?" label="Fixed errors">
      <p className="text-ink">You fixed {done} of {fixed.length}.</p>
      <ul className="space-y-2 list-none p-0">
        {fixed.map((f, i) => {
          const s = STATUS_TEXT[f.status]
          return (
            <li key={`${f.original}-${i}`} className="flex flex-wrap items-baseline gap-2">
              <span className={`font-mono ${s.cls}`} aria-hidden="true">{s.mark}</span>
              <span className="text-ink">{f.original} → {f.correction}</span>
              <span className={`text-sm ${s.cls}`}>{s.text}</span>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

function nextLevelHint(percent) {
  if (percent >= 80) return 'You are at Level 4. Keep adding depth and new connections.'
  if (percent >= 70) return `You are at Level 3. ${80 - percent} more percent reaches Level 4: add a deeper idea or another point of view.`
  return `Level 3 starts at 70%. You need ${70 - percent} more percent: answer every part and back each point with specific evidence.`
}

function StepScores({ scores }) {
  const entries = STEPS.map((s) => ({ ...s, ...scores[s.key] }))
  const lowest = entries.reduce((a, b) => (b.score < a.score ? b : a), entries[0])
  const needsWork = lowest.score < 2 ? lowest.key : null
  return (
    <ul className="space-y-3 list-none p-0">
      {entries.map((s) => (
        <li key={s.key} className="rounded-xl p-3" style={{ background: s.bg }}>
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-ink">{s.label}</span>
            <span className="flex items-center gap-2">
              {s.key === needsWork && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                  Work on this first
                </span>
              )}
              <span className="font-mono text-ink" aria-label={`${s.label} score`}>{s.score}/2</span>
            </span>
          </div>
          {s.note && <p className="mt-1 text-sm text-ink-soft">{s.note}</p>}
        </li>
      ))}
    </ul>
  )
}

export function ColourLegend() {
  return (
    <ul className="flex flex-wrap gap-2 list-none p-0" aria-label="Colour key">
      {STEPS.map((s) => (
        <li key={s.key} className="rounded px-2 py-0.5 text-xs text-ink" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
          {s.label}
        </li>
      ))}
    </ul>
  )
}

function ColouredAnswer({ transcript, sentenceTags }) {
  return (
    <p className="whitespace-pre-wrap leading-relaxed text-ink" data-testid="coloured-answer">
      {colourSegments(transcript, sentenceTags).map((seg, i) =>
        seg.tag ? (
          <mark
            key={i}
            data-step={seg.tag}
            className="rounded px-0.5 text-ink"
            style={{ background: STEP_BY_KEY[seg.tag].bg }}
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </p>
  )
}

function termsUsed(keyTerms, transcript) {
  const text = transcript.toLowerCase()
  return keyTerms.filter((t) => text.includes(t.toLowerCase()))
}

/**
 * The detailed report for one reviewed answer.
 * @param {{ report: object, kind: 'draft'|'rewrite' }} props report = GET /sessions/{id}/report
 */
export default function Report({ report, kind }) {
  const { session, submissions } = report
  const sub = submissions[kind]
  const review = sub?.review
  if (!review) return <p className="text-ink-soft">No review yet.</p>
  const other = kind === 'rewrite' ? submissions.draft?.review : null
  const transcript = sub.confirmed || sub.original
  const missing = missingSteps(review.sentenceTags)
  const used = termsUsed(session.item.key_terms, transcript)
  const changes = sub.diff?.length || 0
  const criteria = review.criteria // older reviews have none, and keep their old layout

  return (
    <div className="space-y-6">
      <Section title="Your result">
        <div className="flex flex-wrap gap-8 pb-6">
          {other && <ResultCard title="Draft" review={other} />}
          <ResultCard title={kind === 'rewrite' ? 'Rewrite' : 'Draft'} review={review} />
        </div>
        {other && (
          <p className="text-ink">
            {review.percent > other.percent
              ? `Your rewrite went up ${review.percent - other.percent} percent. Well done.`
              : review.percent === other.percent
                ? 'Your rewrite scored the same as your draft. Check the next steps below.'
                : 'Your rewrite scored lower than your draft. Look at what changed.'}
          </p>
        )}
        <p>{review.summary}</p>
        <p>{nextLevelHint(review.percent)}</p>
        {review.overall?.capApplied && (
          <p className="rounded-xl bg-muted p-3 text-ink">
            <strong>Your mark is capped.</strong> Your answer has no quote or specific fact, so your teacher&apos;s rule
            keeps your Evidence mark at Level 2- or lower and your overall mark at Level 2+ or lower.
            Add one quote or specific fact to lift it.
          </p>
        )}
        {criteria && <CriteriaMarks criteria={criteria} />}
      </Section>

      {criteria ? (
        <>
          <YourSentences communication={criteria.communication} />
          <Section title="Fix these before you hand it in">
            {criteria.communication.errors.length === 0
              ? <p>No mistakes found. Well done.</p>
              : <ErrorList errors={criteria.communication.errors} />}
          </Section>
        </>
      ) : (
        <>
          <Section title="Your score for each step">
            <StepScores scores={review.scores} />
          </Section>

          <Section title="The four areas">
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ['Knowledge and Understanding', review.categories.knowledge],
                ['Thinking', review.categories.thinking],
                ['Communication', review.categories.communication],
                ['Application', review.categories.application],
              ].map(([name, text]) => (
                <div key={name}>
                  <dt className="font-semibold text-ink">{name}</dt>
                  <dd>{text || 'No comment.'}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </>
      )}

      <Section title="What you missed">
        {review.missedParts.length === 0 ? (
          <p>You answered every part of the question.</p>
        ) : (
          <>
            <p className="text-ink">You did not answer these parts:</p>
            <ul className="list-disc pl-5">{review.missedParts.map((p) => <li key={p}>{p}</li>)}</ul>
          </>
        )}
        {missing.length === 0 ? (
          <p>Every step shows up in your answer.</p>
        ) : (
          <p>
            No sentence matched these steps: <strong className="text-ink">{missing.map((m) => m.label).join(', ')}</strong>.
            A missing colour below shows a missing step.
          </p>
        )}
      </Section>

      <Section title="Your answer in colour">
        <ColourLegend />
        {criteria && (
          <p className="text-sm">
            The colours are for coaching and do not change your mark. Restate, Answer and Extend build your Understanding.
            Cite and Explain build your Evidence.
          </p>
        )}
        <ColouredAnswer transcript={transcript} sentenceTags={review.sentenceTags} />
        {changes > 0 && <p className="text-sm">You fixed {changes} misread {changes === 1 ? 'word' : 'words'} before marking.</p>}
      </Section>

      <Section title="How to improve">
        {review.strengths.length > 0 && (
          <div>
            <h3 className="font-semibold text-ink">What you did well</h3>
            <ul className="list-disc pl-5">{review.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
        )}
        <div>
          <h3 className="font-semibold text-ink">Next steps</h3>
          <ul className="list-disc pl-5">{review.nextSteps.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
        {review.pushQuestion && (
          <p><strong className="text-ink">Push yourself:</strong> {review.pushQuestion}</p>
        )}
        {review.sentenceUpgrade?.original && (
          <div className="rounded-xl bg-muted p-4">
            <p><span className="font-mono text-xs uppercase text-muted-foreground">Your sentence</span><br />{review.sentenceUpgrade.original}</p>
            <p className="mt-2"><span className="font-mono text-xs uppercase text-muted-foreground">A stronger version</span><br /><span className="text-ink">{review.sentenceUpgrade.better}</span></p>
          </div>
        )}
      </Section>

      {!criteria && <ConventionsSection conventions={review.conventions} contentLevel={review.contentLevel} level={review.level} />}
      {kind === 'rewrite' && <FixedErrors fixed={sub.fixed_errors} />}

      <Section title="Your habits">
        <ul className="list-disc pl-5">
          <li>
            Subject words used: {used.length > 0 ? <strong className="text-ink">{used.join(', ')}</strong> : 'none from the list'} (aim for at least two of {session.item.key_terms.join(', ')}).
          </li>
          {session.decode && (
            <li>
              Decode check:{' '}
              {session.decode.command_words_correct && session.decode.parts_correct && session.decode.focus_correct
                ? 'you got the command word, number of parts and thinking focus right.'
                : `you missed ${[
                  !session.decode.command_words_correct && 'the command word',
                  !session.decode.parts_correct && 'the number of parts',
                  !session.decode.focus_correct && 'the thinking focus',
                ].filter(Boolean).join(', ')}.`}
            </li>
          )}
        </ul>
      </Section>
    </div>
  )
}
