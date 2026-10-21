import { useEffect, useRef, useState } from 'react'
import { useSession } from '../context/SessionContext'

/** URL of one textbook page, built by backend/scripts/build_lesson_theory.py. */
export function lessonPageUrl(lessonId, page) {
  return `/lessons/${lessonId}/${page}.jpg`
}

/**
 * Read-through of a curriculum lesson before practising. The pages are the course
 * textbook's own pages (never generated), shown one at a time; the last page ends with
 * "Let's start practice".
 */
export default function LessonTheory() {
  const { state, startLesson, navigateTo } = useSession()
  const { curriculum, theoryLessonId } = state

  const unit = (curriculum ?? []).find((u) => u.lessons.some((l) => l.id === theoryLessonId))
  const lesson = unit?.lessons.find((l) => l.id === theoryLessonId)

  const [pageIndex, setPageIndex] = useState(0)
  const [broken, setBroken] = useState(false)
  const headingRef = useRef(null)

  const total = lesson?.theory_pages ?? 0

  // Warm the next page so "Next" feels instant.
  useEffect(() => {
    if (lesson && pageIndex + 1 < total) {
      new window.Image().src = lessonPageUrl(lesson.id, pageIndex + 2)
    }
  }, [lesson, pageIndex, total])

  useEffect(() => {
    headingRef.current?.scrollIntoView?.({ block: 'start' })
  }, [pageIndex])

  if (!lesson) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-ink-soft">We couldn&apos;t find that lesson.</p>
        <button
          type="button"
          onClick={() => navigateTo('practice')}
          className="mt-4 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Back to lessons
        </button>
      </main>
    )
  }

  const page = pageIndex + 1
  const isLast = page >= total
  const alt = `${lesson.title} — lesson page ${page} of ${total}`

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 md:py-14">
      <header ref={headingRef} className="mb-6">
        <button
          type="button"
          onClick={() => navigateTo('practice')}
          className="text-sm text-ink-soft hover:text-ink"
        >
          ← Back to lessons
        </button>
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          / Unit {unit.number} · Lesson {lesson.id}
        </p>
        <h1 className="mt-2 font-display text-3xl md:text-4xl font-semibold text-ink">{lesson.title}</h1>
        {lesson.focus && (
          <p className="mt-2 text-ink-soft">
            <span className="font-medium text-ink">Today you will:</span> {lesson.focus}
          </p>
        )}
        <div className="mt-5">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Read page {page} of {total}</span>
            <span>Then practise</span>
          </div>
          <div
            className="h-1 w-full rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-label="Lesson progress"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={page}
          >
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(page / total) * 100}%` }} />
          </div>
        </div>
      </header>

      {/* White card: the textbook pages are white-paper scans, so they sit on white, not the dark theme. */}
      <section
        aria-label="Lesson page"
        className={`rounded-2xl ring-soft-lg overflow-hidden ${broken ? 'bg-card' : 'bg-white'}`}
      >
        {broken ? (
          <p role="alert" className="p-8 text-center text-sm text-ink-soft">
            This lesson page isn&apos;t available right now. You can still start the practice questions.
          </p>
        ) : (
          <img
            key={page}
            src={lessonPageUrl(lesson.id, page)}
            alt={alt}
            onError={() => setBroken(true)}
            className="block w-full h-auto"
          />
        )}
      </section>
      {!broken && (
        <p className="mt-2 text-right text-xs">
          <a
            href={lessonPageUrl(lesson.id, page)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-ink underline"
          >
            Open this page larger
          </a>
        </p>
      )}

      <nav aria-label="Lesson pages" className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
          disabled={pageIndex === 0}
          className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium text-ink hover:bg-surface-elevated disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Back
        </button>

        {isLast || broken ? (
          <button
            type="button"
            onClick={() => startLesson(lesson.id)}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground glow-primary hover:scale-[1.02] transition-transform"
          >
            Let&apos;s start practice
            <span aria-hidden="true">→</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPageIndex((i) => Math.min(total - 1, i + 1))}
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Next →
          </button>
        )}
      </nav>
    </main>
  )
}
