import { useState, useCallback } from 'react'
import SketchCanvas from './SketchCanvas'
import FractionText from './FractionText'

const TOPIC_COLORS = {
  'Vedic Maths': { badge: '#facc15', text: '#0f0a1e' },
  'Word Problems': { badge: '#38bdf8', text: '#0f0a1e' },
  'Algebra': { badge: '#a78bfa', text: '#0f0a1e' },
  'Volumes': { badge: '#4ade80', text: '#0f0a1e' },
}
const DEFAULT_BADGE = { badge: '#a78bfa', text: '#0f0a1e' }

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
    (dataUrl) => { onAnswer(question.id, 'sketch', dataUrl) },
    [question.id, onAnswer]
  )

  const handleTextChange = useCallback(
    (e) => { onAnswer(question.id, 'text', e.target.value) },
    [question.id, onAnswer]
  )

  const switchToText = useCallback(() => setMode('text'), [])
  const switchToSketch = useCallback(() => setMode('sketch'), [])

  const topicColor = TOPIC_COLORS[question.topic] ?? DEFAULT_BADGE

  return (
    <article
      className="rounded-card overflow-hidden shadow-xl"
      style={{
        background: 'rgba(26,16,53,0.85)',
        border: '1px solid rgba(167,139,250,0.2)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(167,139,250,0.1)',
      }}
    >
      {/* Card header strip — full width on all sizes */}
      <header
        className="flex items-center gap-3 px-5 py-4"
        style={{ borderBottom: '1px solid rgba(167,139,250,0.15)' }}
      >
        {/* Numbered badge */}
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-heading text-base font-extrabold shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
            color: 'white',
            boxShadow: '0 0 12px rgba(167,139,250,0.5)',
          }}
        >
          {questionNumber}
        </span>

        {/* Topic badge */}
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide"
          style={{ background: topicColor.badge, color: topicColor.text }}
        >
          {question.topic}
        </span>

        {/* Difficulty dots */}
        <span className="ml-auto flex gap-1" aria-label={`Difficulty ${question.difficulty_tier}`}>
          {[1, 2, 3].map((d) => (
            <span
              key={d}
              className="h-2 w-2 rounded-full"
              style={{
                background: d <= question.difficulty_tier ? '#facc15' : 'rgba(250,204,21,0.2)',
                boxShadow: d <= question.difficulty_tier ? '0 0 6px rgba(250,204,21,0.6)' : 'none',
              }}
            />
          ))}
        </span>
      </header>

      {/* Body — stacked on mobile, 2-col on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr]">

        {/* Left: question text */}
        <div
          className="flex flex-col justify-center gap-3 px-5 py-5 md:border-b-0"
          style={{ borderBottom: '1px solid rgba(167,139,250,0.12)' }}
        >
          {/* Decorative accent line */}
          <div
            className="h-1 w-12 rounded-full"
            style={{ background: `linear-gradient(90deg, ${topicColor.badge}, transparent)` }}
          />
          <p className="font-heading text-xl font-extrabold leading-snug md:text-2xl" style={{ color: '#f0e6ff' }}>
            <FractionText text={question.text} />
          </p>
          {/* Mode toggle — visible only on mobile (below question text) */}
          <div className="flex gap-2 pt-1 md:hidden" role="group" aria-label="Answer input mode">
            <button
              type="button"
              onClick={switchToSketch}
              aria-pressed={mode === 'sketch'}
              className="rounded-button px-4 py-1.5 text-sm font-bold transition-all duration-150"
              style={mode === 'sketch' ? {
                background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
                color: 'white',
                boxShadow: '0 0 10px rgba(167,139,250,0.4)',
              } : {
                background: 'rgba(167,139,250,0.12)',
                color: '#a89ec4',
              }}
            >
              ✏️ Sketch
            </button>
            <button
              type="button"
              onClick={switchToText}
              aria-pressed={mode === 'text'}
              className="rounded-button px-4 py-1.5 text-sm font-bold transition-all duration-150"
              style={mode === 'text' ? {
                background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
                color: 'white',
                boxShadow: '0 0 10px rgba(56,189,248,0.4)',
              } : {
                background: 'rgba(56,189,248,0.12)',
                color: '#a89ec4',
              }}
            >
              ⌨️ Text
            </button>
          </div>
        </div>

        {/* Right: mode toggle (desktop only) + answer input */}
        <div
          className="flex flex-col px-5 py-5 gap-3 md:border-l"
          style={{ borderColor: 'rgba(167,139,250,0.15)' }}
        >
          {/* Mode toggle — desktop only */}
          <div className="hidden gap-2 md:flex" role="group" aria-label="Answer input mode">
            <button
              type="button"
              onClick={switchToSketch}
              aria-pressed={mode === 'sketch'}
              className="rounded-button px-4 py-1.5 text-sm font-bold transition-all duration-150"
              style={mode === 'sketch' ? {
                background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
                color: 'white',
                boxShadow: '0 0 10px rgba(167,139,250,0.4)',
              } : {
                background: 'rgba(167,139,250,0.12)',
                color: '#a89ec4',
              }}
            >
              ✏️ Sketch
            </button>
            <button
              type="button"
              onClick={switchToText}
              aria-pressed={mode === 'text'}
              className="rounded-button px-4 py-1.5 text-sm font-bold transition-all duration-150"
              style={mode === 'text' ? {
                background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
                color: 'white',
                boxShadow: '0 0 10px rgba(56,189,248,0.4)',
              } : {
                background: 'rgba(56,189,248,0.12)',
                color: '#a89ec4',
              }}
            >
              ⌨️ Text
            </button>
          </div>

          {/* Answer input */}
          <div className="flex-1">
            {mode === 'sketch' ? (
              <SketchCanvas
                questionId={question.id}
                onExport={handleSketchExport}
              />
            ) : (
              <textarea
                className="w-full rounded-card p-3 font-body text-base placeholder:opacity-50 focus:outline-none resize-none"
                style={{
                  background: 'rgba(15,10,30,0.7)',
                  border: '2px solid rgba(56,189,248,0.4)',
                  color: '#f0e6ff',
                }}
                rows={5}
                placeholder="Type your answer here…"
                value={answer?.mode === 'text' ? answer.content : ''}
                onChange={handleTextChange}
                aria-label={`Text answer for question ${questionNumber}`}
              />
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
