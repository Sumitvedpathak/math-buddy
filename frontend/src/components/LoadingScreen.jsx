import { useState, useEffect, useRef } from 'react'

const FACT_INTERVAL_MS = 4000

const charLeft = new URL('../assets/character-left.svg', import.meta.url).href
const charRight = new URL('../assets/character-right.svg', import.meta.url).href

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
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Glow orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-secondary/20 blur-3xl" />
      </div>

      {/* Corner characters */}
      <img
        src={charLeft}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 hidden w-32 select-none lg:block"
      />
      <img
        src={charRight}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 hidden w-32 select-none lg:block"
      />

      <div className="relative w-full max-w-md text-center space-y-8">
        <h1
          className="font-heading text-3xl font-extrabold"
          style={{ color: '#facc15', textShadow: '0 0 24px rgba(250,204,21,0.5)' }}
        >
          {message}
        </h1>

        {/* Indeterminate progress bar */}
        <div
          className="relative h-4 w-full overflow-hidden rounded-full"
          style={{ background: 'rgba(167,139,250,0.2)' }}
          role="progressbar"
          aria-label={message}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="absolute inset-y-0 left-0 w-1/2 animate-[loading-bar_1.4s_ease-in-out_infinite] rounded-full"
            style={{ background: 'linear-gradient(90deg, #a78bfa, #38bdf8)' }}
          />
        </div>

        {/* Fun fact */}
        {currentFact && (
          <div
            className="rounded-card p-6 shadow-xl"
            style={{
              background: 'rgba(26,16,53,0.85)',
              border: '1px solid rgba(167,139,250,0.25)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#a78bfa' }}>
              ✨ Did you know?
            </p>
            <p className="font-body text-base leading-relaxed" style={{ color: '#f0e6ff' }}>
              {currentFact}
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
