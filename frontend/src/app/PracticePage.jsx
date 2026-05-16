import { useState, useCallback } from 'react'
import { useSession } from '../context/SessionContext'
import { TOPICS } from '../lib/topics'
import QuestionCard from '../components/QuestionCard'
import ErrorBanner from '../components/ErrorBanner'

const AGE_GROUPS = [
  { id: '9-10',  title: 'Age 9–10',  subtitle: 'Junior Explorer — ~Grade 3–4' },
  { id: '11-12', title: 'Age 11–12', subtitle: 'Senior Champion — ~Grade 5–6' },
]

const QUICK_COUNTS = [5, 10, 20, 30]

export default function PracticePage() {
  const {
    state,
    setAgeGroup, toggleTopic, setQuestionCount, startSession,
    setAnswer, submitAnswers,
  } = useSession()
  const { questions, answers, error, ageGroup, selectedTopics, questionCount } = state
  const [confirming, setConfirming] = useState(false)

  // Show setup when no questions have been loaded yet
  const isSetup = questions.length === 0

  const handleAnswer = useCallback(
    (questionId, mode, content) => { setAnswer(questionId, mode, content) },
    [setAnswer]
  )

  const handleSubmitClick = useCallback(() => {
    const hasAnyAnswer = Object.values(answers).some((a) => a.content)
    if (!hasAnyAnswer) {
      setConfirming(true)
    } else {
      submitAnswers(answers)
    }
  }, [answers, submitAnswers])

  const confirmSubmit = useCallback(() => {
    setConfirming(false)
    submitAnswers(answers)
  }, [answers, submitAnswers])

  const cancelSubmit = useCallback(() => setConfirming(false), [])

  if (isSetup) {
    return <SetupStage
      ageGroup={ageGroup}
      setAgeGroup={setAgeGroup}
      selectedTopics={selectedTopics}
      toggleTopic={toggleTopic}
      questionCount={questionCount}
      setQuestionCount={setQuestionCount}
      onStart={startSession}
    />
  }

  const answeredCount = Object.values(answers).filter((a) => a && a.content).length

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 md:py-16">
      {/* Session header */}
      <header className="mb-10 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">/ Session in progress</p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl font-semibold text-ink">
          {questions.length} {questions.length === 1 ? 'Question' : 'Questions'}
        </h1>
        <p className="mt-2 text-ink-soft">Sketch or type your answer — both are saved automatically.</p>
        <div className="mt-6 mx-auto max-w-md">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>{answeredCount} of {questions.length} answered</span>
            <span>{Math.round((answeredCount / questions.length) * 100)}%</span>
          </div>
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            />
          </div>
        </div>
      </header>

      {/* Question list */}
      <ol className="space-y-5 list-none p-0">
        {questions.map((q, i) => (
          <li key={q.id}>
            <QuestionCard
              question={q}
              answer={answers[q.id] ?? null}
              onAnswer={handleAnswer}
              questionNumber={i + 1}
            />
          </li>
        ))}
      </ol>

      {/* Sticky submit */}
      <div className="sticky bottom-6 mt-10 z-30">
        <div className="mx-auto max-w-md">
          <button
            type="button"
            onClick={handleSubmitClick}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-success px-6 py-3.5 text-sm font-semibold text-success-foreground hover:opacity-90 ring-soft-lg"
          >
            ✓ Submit answers
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error.message ?? error} onRetry={() => submitAnswers(answers)} />}

      {/* Empty-submission confirmation */}
      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 backdrop-blur-sm p-4"
          onClick={cancelSubmit}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card ring-soft-lg p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-title" className="font-display text-2xl font-semibold text-ink">
              Are you sure?
            </h3>
            <p className="mt-2 text-sm text-ink-soft">
              You haven&apos;t answered any questions yet. Unanswered questions will receive 0 marks.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelSubmit}
                className="rounded-md px-4 py-2 text-sm text-ink-soft hover:bg-muted"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={confirmSubmit}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
              >
                Submit anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

/* ── Setup Stage ── */
function SetupStage({ ageGroup, setAgeGroup, selectedTopics, toggleTopic, questionCount, setQuestionCount, onStart }) {
  const canStart = selectedTopics.length > 0

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
      <header className="mb-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">/ New practice set</p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl font-semibold text-ink">Configure your session</h1>
        <p className="mt-3 text-ink-soft max-w-2xl">
          Three quick choices. We&apos;ll generate a focused, mixed set tailored to your selection.
        </p>
      </header>

      <div className="rounded-2xl bg-card ring-soft overflow-hidden">

        {/* 01 Age group */}
        <Section number="01" title="Age group" hint="Difficulty scales with your selection.">
          <div className="grid sm:grid-cols-2 gap-3">
            {AGE_GROUPS.map((g) => {
              const active = ageGroup === g.id
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setAgeGroup(g.id)}
                  className={[
                    'text-left rounded-xl border p-5 transition-all',
                    active
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border bg-surface hover:border-ink/20',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-lg font-semibold text-ink">{g.title}</span>
                    <span className={`h-4 w-4 rounded-full border-2 ${active ? 'border-primary bg-primary' : 'border-border'}`} />
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{g.subtitle}</p>
                </button>
              )
            })}
          </div>
        </Section>

        {/* 02 Topics */}
        <Section number="02" title="Topics" hint="Pick one or more — we'll mix them.">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TOPICS.filter((t) => t.enabled).map((t) => {
              const active = selectedTopics.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTopic(t.id)}
                  className={[
                    'text-left rounded-xl border p-4 transition-all',
                    active
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border bg-surface hover:border-ink/20',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-2xl text-primary">{t.emoji}</span>
                    <span className={`h-4 w-4 rounded border-2 grid place-items-center ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>
                      {active && <span className="text-[10px] leading-none">✓</span>}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-base font-semibold text-ink">{t.displayName}</h3>
                  <p className="mt-1 text-xs text-ink-soft">{t.description}</p>
                </button>
              )
            })}
          </div>
          {selectedTopics.length === 0 && (
            <p className="mt-3 text-xs text-destructive" role="alert">
              Please select at least one topic to continue.
            </p>
          )}
        </Section>

        {/* 03 Question count */}
        <Section number="03" title="Number of questions" hint="Between 1 and 100.">
          <div className="flex flex-wrap items-center gap-6">
            <div className="inline-flex items-center rounded-lg border border-border bg-surface overflow-hidden">
              <button
                type="button"
                onClick={() => setQuestionCount(Math.max(1, questionCount - 1))}
                className="h-12 w-12 grid place-items-center text-ink-soft hover:bg-muted hover:text-ink"
                aria-label="Decrease question count"
              >
                −
              </button>
              <input
                type="number"
                value={questionCount}
                min={1}
                max={100}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  if (!isNaN(v) && v >= 1 && v <= 100) setQuestionCount(v)
                }}
                aria-label="Number of questions"
                className="w-20 text-center font-display text-2xl font-semibold text-ink bg-transparent focus:outline-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setQuestionCount(Math.min(100, questionCount + 1))}
                className="h-12 w-12 grid place-items-center text-ink-soft hover:bg-muted hover:text-ink"
                aria-label="Increase question count"
              >
                +
              </button>
            </div>
            <div className="flex gap-2">
              {QUICK_COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQuestionCount(n)}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    questionCount === n ? 'bg-ink text-background' : 'bg-muted text-ink-soft hover:text-ink'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </Section>
      </div>

      {/* CTA */}
      <div className="mt-6 flex items-center justify-between flex-wrap gap-4">
        <p className="text-sm text-ink-soft">
          {canStart ? (
            <>Ready: <strong className="text-ink">{questionCount}</strong> questions across{' '}
            <strong className="text-ink">{selectedTopics.length}</strong> topic{selectedTopics.length > 1 ? 's' : ''}.</>
          ) : 'Select topics to continue.'}
        </p>
        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground ring-soft-lg transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start practice
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  )
}

function Section({ number, title, hint, children }) {
  return (
    <div className="border-b border-border last:border-b-0 p-6 md:p-8">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-5">
        <h2 className="font-display text-xl font-semibold text-ink">
          <span className="font-mono text-xs text-primary mr-3 tracking-wider">{number}</span>
          {title}
        </h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
