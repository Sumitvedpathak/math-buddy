import { useState, useCallback } from 'react'
import SketchCanvas from './SketchCanvas'
import FractionText from './FractionText'

/**
 * QuestionCard — EduSpark two-column layout.
 * Left: question prompt. Right: mode toggle + answer area.
 *
 * @param {{ id: string, topic: string, text: string, difficulty_tier: number }} question
 * @param {{ mode: "sketch"|"text", content: string }|null} answer
 * @param {(questionId: string, mode: "sketch"|"text", content: string) => void} onAnswer
 * @param {number} questionNumber - 1-based display index
 * @param {number} [total] - total question count for position display
 */
export default function QuestionCard({ question, answer, onAnswer, questionNumber, total }) {
  const [mode, setMode] = useState(/** @type {"sketch"|"text"} */ ('sketch'))

  const handleSketchExport = useCallback(
    (dataUrl) => { onAnswer(question.id, 'sketch', dataUrl) },
    [question.id, onAnswer]
  )

  const handleTextChange = useCallback(
    (e) => { onAnswer(question.id, 'text', e.target.value) },
    [question.id, onAnswer]
  )

  const switchToSketch = useCallback(() => setMode('sketch'), [])
  const switchToText   = useCallback(() => setMode('text'),   [])

  return (
    <article className="rounded-2xl bg-card ring-soft overflow-hidden">
      {/* Card header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated">
        <div className="flex items-center gap-3">
          <span className="h-7 w-7 grid place-items-center rounded-full bg-primary text-primary-foreground font-mono text-xs font-semibold">
            {questionNumber}
          </span>
          <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
            {question.topic}
          </span>
        </div>
        {total != null && (
          <span className="text-xs text-muted-foreground font-mono">
            {questionNumber} / {total}
          </span>
        )}
      </header>

      {/* Two-column body */}
      <div className="grid md:grid-cols-2 gap-0">
        {/* Left — question */}
        <div className="p-6 md:p-8 border-b md:border-b-0 md:border-r border-border">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Question</p>
          <p className="mt-3 font-display text-xl leading-snug text-ink">
            <FractionText text={question.text} />
          </p>
        </div>

        {/* Right — answer area */}
        <div className="p-6 md:p-8 bg-surface-elevated/50">
          {/* Mode toggle */}
          <div className="flex items-center gap-2 mb-4" role="group" aria-label="Answer input mode">
            <ModeBtn active={mode === 'sketch'} onClick={switchToSketch}>✎ Sketch</ModeBtn>
            <ModeBtn active={mode === 'text'}   onClick={switchToText}>⌨ Text</ModeBtn>
          </div>

          {mode === 'text' ? (
            <textarea
              value={answer?.mode === 'text' ? answer.content : ''}
              onChange={handleTextChange}
              placeholder="Type your answer here…"
              aria-label={`Text answer for question ${questionNumber}`}
              className="w-full h-40 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-foreground"
            />
          ) : (
            <SketchCanvas
              questionId={question.id}
              onExport={handleSketchExport}
            />
          )}
        </div>
      </div>
    </article>
  )
}

function ModeBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-ink-soft hover:text-ink',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
