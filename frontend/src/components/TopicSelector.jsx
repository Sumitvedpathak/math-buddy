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
            style={{
              background: topic.gradient,
              border: isSelected
                ? `2px solid ${topic.glow.replace('0.6)', '1)')}`
                : '2px solid rgba(255,255,255,0.08)',
              boxShadow: isSelected
                ? `0 0 22px ${topic.glow}, 0 4px 20px rgba(0,0,0,0.4)`
                : '0 2px 12px rgba(0,0,0,0.3)',
              transform: isSelected ? 'translateY(-3px)' : 'none',
              transition: 'all 0.2s ease',
            }}
            className="relative flex flex-col items-start gap-1.5 rounded-card p-4 text-left"
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.boxShadow = `0 0 18px ${topic.glow}, 0 4px 20px rgba(0,0,0,0.4)`
                e.currentTarget.style.transform = 'translateY(-2px)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.3)'
                e.currentTarget.style.transform = 'none'
              }
            }}
          >
            {/* Selected checkmark badge */}
            {isSelected && (
              <span
                className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
                style={{ background: 'rgba(255,255,255,0.25)', color: '#fff' }}
              >
                ✓
              </span>
            )}

            {/* Emoji icon */}
            <span className="text-2xl leading-none">{topic.emoji}</span>

            {/* Name */}
            <span className="font-heading text-sm font-extrabold text-white leading-tight">
              {topic.displayName}
            </span>

            {/* Description */}
            <span className="text-xs leading-snug" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {topic.description}
            </span>
          </button>
        )
      })}
    </div>
  )
}
