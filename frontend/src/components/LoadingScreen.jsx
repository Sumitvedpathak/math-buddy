import { useState, useEffect, useRef } from 'react'

const FACT_INTERVAL_MS = 4000

/**
 * LoadingScreen — shared component for question generation and answer evaluation.
 * Animated indeterminate progress bar + non-repeating fun fact rotation.
 *
 * @param {{ funFacts: string[], message?: string }} props
 */
export default function LoadingScreen({ funFacts = [], message = 'Loading…' }) {
  const [factIndex, setFactIndex] = useState(0)
  const usedIndicesRef = useRef([0])

  useEffect(() => {
    if (funFacts.length <= 1) return
    const interval = setInterval(() => {
      setFactIndex((prev) => {
        let next = (prev + 1) % funFacts.length
        if (usedIndicesRef.current.length >= funFacts.length) {
          usedIndicesRef.current = []
        }
        while (usedIndicesRef.current.includes(next)) {
          next = (next + 1) % funFacts.length
        }
        usedIndicesRef.current.push(next)
        return next
      })
    }, FACT_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [funFacts])

  const currentFact = funFacts[factIndex] ?? ''

  return (
    <div className="min-h-[60vh] grid place-items-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">/ Generating</p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-ink">{message}</h2>

        {/* Indeterminate progress bar */}
        <div
          className="mt-8 h-1 w-full rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-label={message}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full w-1/2 bg-primary animate-loading-bar rounded-full" />
        </div>

        {/* Fun fact card */}
        {currentFact && (
          <div className="mt-10 rounded-xl bg-card ring-soft p-6 text-left">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Did you know?</p>
            <p className="mt-2 text-sm text-ink leading-relaxed">{currentFact}</p>
          </div>
        )}
      </div>
    </div>
  )
}
