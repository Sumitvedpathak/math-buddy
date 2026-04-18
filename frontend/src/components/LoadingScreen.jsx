import { useState, useEffect, useRef } from 'react'

const FACT_INTERVAL_MS = 4000

/**
 * LoadingScreen — shared component for both question generation and answer evaluation phases.
 * Displays an animated indeterminate progress bar and cycles through fun facts without repeating.
 *
 * @param {Object} props
 * @param {string[]} props.funFacts - Array of fun fact strings to cycle through
 * @param {string} [props.message] - Heading message shown above the progress bar
 */
export default function LoadingScreen({ funFacts = [], message = 'Loading…' }) {
  const [factIndex, setFactIndex] = useState(0)
  const usedIndicesRef = useRef([0])

  useEffect(() => {
    if (funFacts.length <= 1) return
    const interval = setInterval(() => {
      setFactIndex((prev) => {
        let next = (prev + 1) % funFacts.length
        // Reset cycle when all facts shown
        if (usedIndicesRef.current.length >= funFacts.length) {
          usedIndicesRef.current = []
        }
        // Skip already-used indices
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
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center space-y-8">
        <h1 className="font-heading text-3xl font-extrabold text-primary-dark">{message}</h1>

        {/* Indeterminate progress bar */}
        <div
          className="relative h-4 w-full overflow-hidden rounded-full bg-primary/20"
          role="progressbar"
          aria-label={message}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="absolute inset-y-0 left-0 w-1/2 animate-[loading-bar_1.4s_ease-in-out_infinite] rounded-full bg-primary" />
        </div>

        {/* Fun fact */}
        {currentFact && (
          <div className="rounded-card bg-surface p-6 shadow-md">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-2">
              Did you know?
            </p>
            <p className="font-body text-base text-text-primary leading-relaxed">
              {currentFact}
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
