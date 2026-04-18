import { useSession } from '../context/SessionContext'
import AgeGroupSelector from '../components/AgeGroupSelector'
import TopicSelector from '../components/TopicSelector'
import ErrorBanner from '../components/ErrorBanner'

const charLeft = new URL('../assets/character-left.svg', import.meta.url).href
const charRight = new URL('../assets/character-right.svg', import.meta.url).href

/**
 * HomeScreen — entry point where the student configures their session.
 * Composes AgeGroupSelector, TopicSelector, question count input, and Start Practice button.
 */
export default function HomeScreen() {
  const { state, setAgeGroup, toggleTopic, setQuestionCount, startSession } = useSession()
  const { ageGroup, selectedTopics, questionCount, error } = state

  const canStart = selectedTopics.length > 0

  function decrement() {
    if (questionCount > 1) setQuestionCount(questionCount - 1)
  }
  function increment() {
    if (questionCount < 100) setQuestionCount(questionCount + 1)
  }

  return (
    <main className="relative flex flex-col items-center overflow-hidden px-4 py-6">
      {/* Decorative glow orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Corner characters — hidden on very small screens */}
      <img
        src={charLeft}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 hidden w-36 select-none lg:block"
      />
      <img
        src={charRight}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 hidden w-36 select-none lg:block"
      />

      {/* Hero */}
      <div className="relative mb-5 text-center">
        <h1 className="font-heading text-3xl font-extrabold drop-shadow-lg sm:text-5xl"
          style={{ color: '#facc15', textShadow: '0 0 30px rgba(250,204,21,0.5)' }}
        >
          Math Buddy ✨
        </h1>
        <p className="mt-2 text-base font-medium sm:mt-3 sm:text-lg" style={{ color: '#a89ec4' }}>
          Pick your topics, choose your level, and let&apos;s practise!
        </p>
      </div>

      {/* Main card — 92% mobile, capped at 70% desktop */}
      <div
        className="relative w-[92%] rounded-card p-5 shadow-2xl space-y-5 sm:p-8 sm:space-y-6 lg:w-[70%]"
        style={{
          background: 'rgba(30, 20, 60, 0.90)',
          border: '1px solid rgba(167, 139, 250, 0.35)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 0 60px rgba(167,139,250,0.18), 0 8px 16px rgba(167,139,250,0.08), 0 24px 64px rgba(0,0,0,0.55)',
        }}
      >
        {/* Age Group */}
        <section>
          <h2
            className="mb-3 font-heading text-xs font-bold uppercase tracking-widest"
            style={{ color: '#a78bfa' }}
          >
            Age Group
          </h2>
          <AgeGroupSelector value={ageGroup} onChange={setAgeGroup} />
        </section>

        {/* Divider */}
        <div style={{ borderTop: '1px solid rgba(167,139,250,0.15)' }} />

        {/* Topics */}
        <section>
          <h2
            className="mb-3 font-heading text-xs font-bold uppercase tracking-widest"
            style={{ color: '#a78bfa' }}
          >
            Topics
          </h2>
          <TopicSelector selected={selectedTopics} onToggle={toggleTopic} />
          {selectedTopics.length === 0 && (
            <p className="mt-2 text-sm text-error" role="alert">
              Please select at least one topic to continue.
            </p>
          )}
        </section>

        {/* Divider */}
        <div style={{ borderTop: '1px solid rgba(167,139,250,0.15)' }} />

        {/* Question Count */}
        <section>
          <h2
            className="mb-3 font-heading text-xs font-bold uppercase tracking-widest"
            style={{ color: '#a78bfa' }}
          >
            Number of Questions
          </h2>
          <div className="flex items-center gap-0">
            {/* Decrement */}
            <button
              type="button"
              onClick={decrement}
              disabled={questionCount <= 1}
              aria-label="Decrease question count"
              style={{
                background: 'rgba(167,139,250,0.12)',
                border: '1px solid rgba(250,204,21,0.35)',
                borderRight: 'none',
                borderRadius: '12px 0 0 12px',
                color: questionCount <= 1 ? 'rgba(168,158,196,0.3)' : '#facc15',
                transition: 'background 0.15s',
              }}
              className="flex h-11 w-11 items-center justify-center text-xl font-bold hover:bg-[rgba(167,139,250,0.22)] disabled:cursor-not-allowed"
            >
              −
            </button>

            {/* Display / direct input */}
            <input
              type="number"
              min={1}
              max={100}
              value={questionCount}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val) && val >= 1 && val <= 100) setQuestionCount(val)
              }}
              aria-label="Number of questions"
              style={{
                background: 'rgba(36,24,72,0.9)',
                border: '1px solid rgba(250,204,21,0.35)',
                color: '#facc15',
                minWidth: '4rem',
                textAlign: 'center',
                outline: 'none',
                MozAppearance: 'textfield',
              }}
              className="h-11 font-heading text-xl font-extrabold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />

            {/* Increment */}
            <button
              type="button"
              onClick={increment}
              disabled={questionCount >= 100}
              aria-label="Increase question count"
              style={{
                background: 'rgba(167,139,250,0.12)',
                border: '1px solid rgba(250,204,21,0.35)',
                borderLeft: 'none',
                borderRadius: '0 12px 12px 0',
                color: questionCount >= 100 ? 'rgba(168,158,196,0.3)' : '#facc15',
                transition: 'background 0.15s',
              }}
              className="flex h-11 w-11 items-center justify-center text-xl font-bold hover:bg-[rgba(167,139,250,0.22)] disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
          <p className="mt-2 text-xs" style={{ color: '#a89ec4' }}>Between 1 and 100</p>
        </section>

        {/* CTA */}
        <div className="relative">
          {/* Pulsing glow ring — only shown when button is enabled */}
          {canStart && (
            <div
              className="absolute inset-0 rounded-button"
              style={{
                boxShadow: '0 0 0 0 rgba(250,204,21,0.5)',
                animation: 'ctaPulse 2s ease-out infinite',
                pointerEvents: 'none',
              }}
            />
          )}
          <button
            type="button"
            onClick={startSession}
            disabled={!canStart}
            className={[
              'relative w-full rounded-button py-4 font-heading text-xl font-extrabold transition-all duration-200',
              canStart
                ? 'active:scale-95 hover:-translate-y-1 hover:brightness-110'
                : 'cursor-not-allowed opacity-40',
            ].join(' ')}
            style={canStart ? {
              background: 'linear-gradient(135deg, #facc15 0%, #f59e0b 50%, #ea580c 100%)',
              color: '#0f0a1e',
              boxShadow: '0 0 24px rgba(250,204,21,0.45), 0 0 8px rgba(234,88,12,0.3), 0 6px 20px rgba(0,0,0,0.35)',
              letterSpacing: '0.03em',
            } : { background: 'rgba(250,204,21,0.15)', color: '#a89ec4' }}
          >
            🚀&nbsp; Start Practice
          </button>
        </div>
      </div>

      {/* Error modal */}
      {error && <ErrorBanner message={error} onRetry={startSession} />}
    </main>
  )
}
