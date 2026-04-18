import { useState, useCallback } from 'react'
import SketchCanvas from './SketchCanvas'

/**
 * QuestionCard — displays a single question and an answer input (sketch or text).
 *
 * @param {Object} props
 * @param {{ id: string, topic: string, text: string, difficulty_tier: number }} props.question
 * @param {{ mode: "sketch"|"text", content: string }|null} props.answer
 * @param {(questionId: string, mode: "sketch"|"text", content: string) => void} props.onAnswer
 * @param {number} props.questionNumber - 1-based display index
 */
export default function QuestionCard({ question, answer, onAnswer, questionNumber }) {
  const [mode, setMode] = useState(/** @type {"sketch"|"text"} */ ('sketch'))

  const handleSketchExport = useCallback(
    (dataUrl) => {
      onAnswer(question.id, 'sketch', dataUrl)
    },
    [question.id, onAnswer]
  )

  const handleTextChange = useCallback(
    (e) => {
      onAnswer(question.id, 'text', e.target.value)
    },
    [question.id, onAnswer]
  )

  const switchToText = useCallback(() => setMode('text'), [])
  const switchToSketch = useCallback(() => setMode('sketch'), [])

  return (
    <article className="rounded-card bg-surface p-5 shadow-md space-y-4">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
          {questionNumber}
        </span>
        <p className="flex-1 font-body text-base font-semibold text-text-primary leading-snug">
          {question.text}
        </p>
      </header>

      {/* Mode toggle */}
      <div className="flex gap-2" role="group" aria-label="Answer input mode">
        <button
          type="button"
          onClick={switchToSketch}
          aria-pressed={mode === 'sketch'}
          className={`rounded-button px-3 py-1.5 text-sm font-medium transition ${
            mode === 'sketch'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-surface text-text-secondary hover:bg-primary/10'
          }`}
        >
          Sketch
        </button>
        <button
          type="button"
          onClick={switchToText}
          aria-pressed={mode === 'text'}
          className={`rounded-button px-3 py-1.5 text-sm font-medium transition ${
            mode === 'text'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-surface text-text-secondary hover:bg-primary/10'
          }`}
        >
          Text
        </button>
      </div>

      {/* Answer input */}
      {mode === 'sketch' ? (
        <SketchCanvas
          questionId={question.id}
          onExport={handleSketchExport}
        />
      ) : (
        <textarea
          className="w-full rounded-card border-2 border-primary/30 bg-white p-3 font-body text-base text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none resize-none"
          rows={3}
          placeholder="Type your answer here…"
          value={answer?.mode === 'text' ? answer.content : ''}
          onChange={handleTextChange}
          aria-label={`Text answer for question ${questionNumber}`}
        />
      )}
    </article>
  )
}
