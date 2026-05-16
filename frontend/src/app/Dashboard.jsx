import { useSession } from '../context/SessionContext'
import FractionText from '../components/FractionText'

function getStudentAnswerLine(result, submitted) {
  const fromLlm = result.studentAnswer?.trim()
  if (fromLlm) return fromLlm
  if (!submitted?.content?.trim()) return null
  if (submitted.mode === 'text') {
    const t = submitted.content.trim()
    return t.length > 220 ? `${t.slice(0, 220)}…` : t
  }
  return null
}

function contextualMessage(pct) {
  if (pct === 100) return 'Flawless. That\'s mastery.'
  if (pct >= 70)  return 'Strong work. A few refinements and you\'re there.'
  if (pct >= 40)  return 'Good effort — review the working, then try again.'
  return 'Keep practising — every attempt builds intuition.'
}

export default function Dashboard() {
  const { state, resetSession } = useSession()
  const { evaluationResult, questions, answers: answersRaw } = state
  const answers = answersRaw ?? {}

  if (!evaluationResult) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className="text-ink-soft">No results available.</p>
      </main>
    )
  }

  const { results, totalScore, maxScore, topicBreakdown } = evaluationResult
  const questionMap = Object.fromEntries((questions ?? []).map((q) => [q.id, q]))
  const percent = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 md:py-16 space-y-12">

      {/* ── Score hero ── */}
      <section className="rounded-3xl overflow-hidden ring-soft-lg bg-card">
        <div className="grid md:grid-cols-[1.2fr_1fr]">

          {/* Left — score */}
          <div className="p-10 md:p-14 bg-primary text-primary-foreground relative overflow-hidden">
            <div className="absolute inset-0 grid-paper opacity-[0.08] pointer-events-none" aria-hidden="true" />
            <div className="relative">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground/60">/ Results</p>
              <div className="mt-4 flex items-baseline gap-3">
                <span className="font-display text-7xl md:text-8xl font-semibold leading-none">{totalScore}</span>
                <span className="font-display text-3xl text-primary-foreground/60">/ {maxScore}</span>
              </div>
              <p className="mt-3 text-lg text-primary-foreground/80">{percent}% correct</p>
              <p className="mt-6 max-w-sm text-sm text-primary-foreground/70 leading-relaxed">
                {contextualMessage(percent)}
              </p>
            </div>
          </div>

          {/* Right — topic breakdown + CTA */}
          <div className="p-10 md:p-14">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">/ By topic</p>
            <ul className="mt-5 space-y-4">
              {Object.entries(topicBreakdown).map(([topic, data]) => (
                <li key={topic}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-ink capitalize">{topic}</span>
                    <span className="font-mono text-ink-soft">{data.score} / {data.maxScore}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(data.score / data.maxScore) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={resetSession}
              className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-md bg-ink text-background px-5 py-3 text-sm font-medium hover:opacity-90"
              aria-label="Start a new set"
            >
              Start a new set
            </button>
          </div>
        </div>
      </section>

      {/* ── Question review ── */}
      <section>
        <h2 className="font-display text-3xl font-semibold text-ink">Question review</h2>
        <p className="mt-1 text-ink-soft">Read each one carefully — the working is half the lesson.</p>

        <div className="mt-6 space-y-3">
          {results.map((r, i) => {
            const q = questionMap[r.questionId]
            const submitted = answers[r.questionId]
            const studentLine = r.marks < 2 ? getStudentAnswerLine(r, submitted) : null
            const isCorrect = r.marks === 2
            const showAnswers = r.marks < 2 && (studentLine || r.correctAnswer)

            return (
              <article key={r.questionId} className="rounded-xl bg-card ring-soft p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    <span className="font-mono text-xs text-muted-foreground mt-1">#{i + 1}</span>
                    <p className="font-display text-lg leading-snug text-ink max-w-3xl">
                      {q ? <FractionText text={q.text} /> : r.questionId}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                    isCorrect
                      ? 'bg-success/15 text-success'
                      : 'bg-destructive/10 text-destructive'
                  }`}>
                    {isCorrect ? 'Correct' : 'Review'}
                  </span>
                </div>

                <p className="mt-3 text-sm text-ink-soft leading-relaxed pl-8">{r.feedback}</p>

                {showAnswers && (
                  <div className="mt-4 grid md:grid-cols-2 gap-3 pl-8">
                    {(studentLine || (submitted?.mode === 'sketch' && r.correctAnswer)) && (
                      <div className="rounded-lg border border-border bg-surface-elevated p-4">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Your answer</p>
                        <p className="mt-1 text-sm text-ink font-mono break-words">
                          {studentLine
                            ? <FractionText text={studentLine} />
                            : <em className="not-italic text-muted-foreground">(sketch submitted)</em>
                          }
                        </p>
                      </div>
                    )}
                    {r.correctAnswer && (
                      <div className="rounded-lg border border-success/30 bg-success/5 p-4">
                        <p className="text-[10px] uppercase tracking-wider text-success">Correct answer</p>
                        <p className="mt-1 text-sm text-ink font-mono">
                          <FractionText text={r.correctAnswer} />
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}
