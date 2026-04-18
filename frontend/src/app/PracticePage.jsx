import { useState, useCallback } from 'react'
import { useSession } from '../context/SessionContext'
import QuestionCard from '../components/QuestionCard'

/**
 * PracticePage — renders all questions and handles submission.
 * Confirms before submitting if no answers have been provided.
 */
export default function PracticePage() {
  const { state, setAnswer, submitAnswers } = useSession()
  const { questions, answers, error } = state
  const [confirming, setConfirming] = useState(false)

  const handleAnswer = useCallback(
    (questionId, mode, content) => {
      setAnswer(questionId, mode, content)
    },
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
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-extrabold text-primary-dark">
            Practice — {questions.length} Questions
          </h1>
        </header>

        {error && (
          <div role="alert" className="rounded-card bg-red-100 p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Question list */}
        <ol className="space-y-6 list-none p-0">
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

        {/* Submit */}
        <div className="sticky bottom-4 flex justify-center">
          <button
            type="button"
            onClick={handleSubmitClick}
            className="rounded-button bg-primary px-8 py-3 font-heading text-lg font-bold text-white shadow-lg hover:bg-primary/90 active:scale-95 transition"
          >
            Submit Answers
          </button>
        </div>
      </div>

      {/* Empty-submission confirmation dialog */}
      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className="fixed inset-0 flex items-center justify-center bg-black/40 px-4"
        >
          <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-xl space-y-4">
            <h2 id="confirm-title" className="font-heading text-lg font-bold text-text-primary">
              Are you sure?
            </h2>
            <p className="font-body text-sm text-text-secondary">
              You haven't answered any questions yet. Submit anyway?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={cancelSubmit}
                className="rounded-button px-4 py-2 text-sm font-medium text-text-secondary hover:bg-primary/10 transition"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={confirmSubmit}
                className="rounded-button bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 transition"
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
