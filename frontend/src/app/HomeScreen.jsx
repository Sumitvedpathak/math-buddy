import { useSession } from '../context/SessionContext'
import AgeGroupSelector from '../components/AgeGroupSelector'
import TopicSelector from '../components/TopicSelector'

/**
 * HomeScreen — entry point where the student configures their session.
 * Composes AgeGroupSelector, TopicSelector, question count input, and Start Practice button.
 */
export default function HomeScreen() {
  const { state, setAgeGroup, toggleTopic, setQuestionCount, startSession } = useSession()
  const { ageGroup, selectedTopics, questionCount } = state

  const canStart = selectedTopics.length > 0

  function handleQuestionCountChange(e) {
    const val = parseInt(e.target.value, 10)
    if (!isNaN(val) && val >= 1 && val <= 100) {
      setQuestionCount(val)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* Hero */}
      <div className="mb-8 text-center">
        <h1 className="font-heading text-4xl font-extrabold text-primary-dark drop-shadow-sm">
          Math Buddy 🌟
        </h1>
        <p className="mt-2 text-text-secondary">
          Pick your topics, choose your level, and let&apos;s practise!
        </p>
      </div>

      <div className="w-full max-w-xl rounded-card bg-surface p-8 shadow-lg space-y-6">
        {/* Age Group */}
        <section>
          <h2 className="mb-2 font-semibold text-text-primary">Age Group</h2>
          <AgeGroupSelector value={ageGroup} onChange={setAgeGroup} />
        </section>

        {/* Topics */}
        <section>
          <h2 className="mb-2 font-semibold text-text-primary">Topics</h2>
          <TopicSelector selected={selectedTopics} onToggle={toggleTopic} />
          {selectedTopics.length === 0 && (
            <p className="mt-2 text-sm text-error" role="alert">
              Please select at least one topic to continue.
            </p>
          )}
        </section>

        {/* Question Count */}
        <section>
          <h2 className="mb-2 font-semibold text-text-primary">Number of Questions</h2>
          <input
            type="number"
            min={1}
            max={100}
            value={questionCount}
            onChange={handleQuestionCountChange}
            className="w-28 rounded-button border border-primary/40 bg-surface-raised px-3 py-2 text-center font-semibold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Number of questions"
          />
          <p className="mt-1 text-xs text-text-secondary">Between 1 and 100</p>
        </section>

        {/* CTA */}
        <button
          type="button"
          onClick={startSession}
          disabled={!canStart}
          className={[
            'w-full rounded-button py-3 font-heading text-lg font-extrabold transition',
            canStart
              ? 'bg-primary text-text-primary shadow hover:bg-primary-dark active:scale-95'
              : 'cursor-not-allowed bg-primary/30 text-text-secondary',
          ].join(' ')}
        >
          Start Practice
        </button>
      </div>
    </main>
  )
}
