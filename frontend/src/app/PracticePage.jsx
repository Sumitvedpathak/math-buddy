import { useState, useCallback } from 'react'
import { useSession } from '../context/SessionContext'
import QuestionCard from '../components/QuestionCard'
import ErrorBanner from '../components/ErrorBanner'

/**
 * PracticePage — renders all questions and handles submission.
 * Confirms before submitting if no answers have been provided.
 */
export default function PracticePage() {
  const { state, setAnswer, submitAnswers } = useSession()
  const { questions, answers, error } = state
  const [confirming, setConfirming] = useState(false)

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

  return (
    <main className="min-h-screen px-4 py-8">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-[95%] max-w-5xl space-y-5">
        {/* Page header */}
        <header className="text-center py-4">
          <h1
            className="font-heading text-3xl font-extrabold sm:text-4xl"
            style={{ color: '#facc15', textShadow: '0 0 28px rgba(250,204,21,0.45)' }}
          >
            📚 {questions.length} {questions.length === 1 ? 'Question' : 'Questions'}
          </h1>
          <p className="mt-1 text-sm font-medium" style={{ color: '#a89ec4' }}>
            Answer each question below — sketch or type!
          </p>
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

        {/* Submit button */}
        <div className="sticky bottom-4 flex justify-center pb-4">
          <button
            type="button"
            onClick={handleSubmitClick}
            className="rounded-button px-10 py-4 font-heading text-xl font-extrabold transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
              color: '#0f0a1e',
              boxShadow: '0 0 24px rgba(74,222,128,0.4), 0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            ✅ Submit Answers
          </button>
        </div>
      </div>

      {/* Error modal */}
      {error && <ErrorBanner message={error} onRetry={() => submitAnswers(answers)} />}

      {/* Empty-submission confirmation dialog */}
      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
          <div
            className="relative w-full max-w-sm rounded-card p-6 shadow-2xl space-y-4"
            style={{
              background: 'rgba(26,16,53,0.95)',
              border: '1px solid rgba(167,139,250,0.35)',
              boxShadow: '0 0 40px rgba(167,139,250,0.2)',
            }}
          >
            <h2 id="confirm-title" className="font-heading text-lg font-bold" style={{ color: '#f0e6ff' }}>
              Are you sure?
            </h2>
            <p className="font-body text-sm" style={{ color: '#a89ec4' }}>
              You haven&apos;t answered any questions yet. Submit anyway?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={cancelSubmit}
                className="rounded-button px-4 py-2 text-sm font-medium transition hover:bg-white/10"
                style={{ color: '#a89ec4' }}
              >
                Go back
              </button>
              <button
                type="button"
                onClick={confirmSubmit}
                className="rounded-button px-4 py-2 text-sm font-bold transition active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #facc15, #eab308)',
                  color: '#0f0a1e',
                  boxShadow: '0 0 12px rgba(250,204,21,0.3)',
                }}
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
