import { TOPICS } from '../lib/topics'

/**
 * TopicSelector — multi-select card grid driven by TOPICS config.
 *
 * @param {Object} props
 * @param {string[]} props.selected - array of selected topic IDs
 * @param {(topicId: string) => void} props.onToggle - called with topic ID on click
 */
export default function TopicSelector({ selected, onToggle }) {
  const enabled = TOPICS.filter((t) => t.enabled)

  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      role="group"
      aria-label="Practice topics"
    >
      {enabled.map((topic) => {
        const isSelected = selected.includes(topic.id)
        return (
          <button
            key={topic.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle(topic.id)}
            className={[
              'rounded-card border px-4 py-3 text-sm font-semibold transition',
              isSelected
                ? 'border-primary bg-primary text-text-primary shadow-md'
                : 'border-primary/30 bg-surface text-text-secondary hover:bg-primary/15',
            ].join(' ')}
          >
            {topic.displayName}
          </button>
        )
      })}
    </div>
  )
}
