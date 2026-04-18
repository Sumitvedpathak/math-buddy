import { useSession } from '../context/SessionContext'
import ScoreCard from '../components/ScoreCard'
import FractionText from '../components/FractionText'

/**
 * Dashboard — shows evaluation results: total score, topic breakdown, per-question feedback.
 */
export default function Dashboard() {
  const { state, resetSession } = useSession()
  const { evaluationResult, questions } = state

  if (!evaluationResult) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-text-secondary">No results available.</p>
      </main>
    )
  }

  const { results, totalScore, maxScore, topicBreakdown } = evaluationResult
  const questionMap = Object.fromEntries((questions ?? []).map((q) => [q.id, q]))
  const percent = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Hero score */}
        <section className="rounded-card bg-primary p-5 text-center text-white shadow-lg sm:p-8">
          <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">
            {totalScore} / {maxScore}
          </h1>
          <p className="mt-1 font-body text-lg opacity-90">{percent}% correct</p>
          <p className="mt-3 font-body text-sm opacity-75">
            {percent >= 80 ? '🎉 Outstanding work!' : percent >= 50 ? 'Good effort, keep going!' : 'Keep practising, you can do it!'}
          </p>
        </section>

        {/* Topic breakdown */}
        {Object.keys(topicBreakdown).length > 0 && (
          <section className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-text-primary">By Topic</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(topicBreakdown).map(([topic, data]) => (
                <ScoreCard
                  key={topic}
                  topic={topic}
                  score={data.score}
                  maxScore={data.maxScore}
                  questionCount={data.questionCount}
                />
              ))}
            </div>
          </section>
        )}

        {/* Per-question feedback */}
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-bold text-text-primary">Question Review</h2>
          <ol className="space-y-3 list-none p-0">
            {results.map((r, i) => {
              const q = questionMap[r.questionId]
              return (
                <li key={r.questionId} className="rounded-card bg-surface p-4 shadow-sm space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-body text-sm font-semibold text-text-primary flex-1">
                      <span className="mr-2 text-text-secondary">#{i + 1}</span>
                      {q ? <FractionText text={q.text} fontSize="0.9em" /> : r.questionId}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                        r.marks === 2
                          ? 'bg-green-100 text-green-700'
                          : r.marks === 1
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {r.marks}/2
                    </span>
                  </div>
                  <p className="font-body text-sm text-text-secondary">{r.feedback}</p>
                </li>
              )
            })}
          </ol>
        </section>

        {/* Try again */}
        <div className="flex justify-center pb-8">
          <button
            type="button"
            onClick={resetSession}
            className="rounded-button bg-primary px-8 py-3 font-heading text-lg font-bold text-white shadow-lg hover:bg-primary/90 active:scale-95 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    </main>
  )
}
