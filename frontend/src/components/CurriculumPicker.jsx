import { useState } from 'react'
import { CURRICULUM_QUESTION_COUNT } from '../context/SessionContext'

/**
 * Unit cards that expand into a lesson list. Each lesson shows a mastered badge
 * (from /lesson-status) and a Practice button that starts a fixed-size session.
 *
 * @param {Object} props
 * @param {Array<{id: string, number: number, title: string, lessons: Array<{id: string, title: string, focus: string}>}>} props.units
 * @param {Record<string, {completed: boolean, bestScorePct: number}>} props.lessonStatus
 * @param {(lessonId: string) => void} props.onPractice
 */
export default function CurriculumPicker({ units, lessonStatus, onPractice }) {
  const [openUnit, setOpenUnit] = useState(null)

  return (
    <div className="space-y-3" role="group" aria-label="Curriculum units">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {units.map((unit) => {
          const open = openUnit === unit.id
          const done = unit.lessons.filter((l) => lessonStatus[l.id]?.completed).length
          return (
            <button
              key={unit.id}
              type="button"
              aria-expanded={open}
              onClick={() => setOpenUnit(open ? null : unit.id)}
              className={[
                'text-left rounded-xl border p-4 transition-all',
                open
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border bg-surface hover:border-ink/20',
              ].join(' ')}
            >
              <span className="font-mono text-xs text-primary">Unit {unit.number}</span>
              <h3 className="mt-2 font-display text-base font-semibold text-ink">{unit.title}</h3>
              <p className="mt-1 text-xs text-ink-soft">
                {done} of {unit.lessons.length} lessons mastered
              </p>
            </button>
          )
        })}
      </div>

      {units.filter((u) => u.id === openUnit).map((unit) => (
        <section
          key={unit.id}
          aria-label={`Unit ${unit.number} lessons`}
          className="rounded-xl border border-border bg-surface p-2"
        >
          <ul className="list-none p-0 divide-y divide-border">
            {unit.lessons.map((lesson) => {
              const status = lessonStatus[lesson.id]
              return (
                <li key={lesson.id} className="flex items-center justify-between gap-4 p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{lesson.id}</span>
                      {lesson.title}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">{lesson.focus}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {status?.completed ? (
                      <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
                        ✓ Mastered
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                        {status ? `Best ${Math.floor(status.bestScorePct)}%` : 'Not started'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onPractice(lesson.id)}
                      aria-label={`Practice lesson ${lesson.id}: ${lesson.title}`}
                      className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                    >
                      Practice
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="px-3 pb-2 pt-1 text-xs text-muted-foreground">
            Each lesson is a set of {CURRICULUM_QUESTION_COUNT} questions. Score 95% or more to master it.
          </p>
        </section>
      ))}
    </div>
  )
}
