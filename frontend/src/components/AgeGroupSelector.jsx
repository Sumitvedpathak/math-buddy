/**
 * AgeGroupSelector — two styled cards side by side.
 * Selected card gets a glowing filled background; unselected is dark outlined.
 *
 * @param {Object} props
 * @param {"9-10"|"11-12"} props.value - currently selected age group
 * @param {(value: string) => void} props.onChange - called with the new value on click
 */
export default function AgeGroupSelector({ value, onChange }) {
  const options = [
    { value: '9-10',  label: 'Age 9–10',  emoji: '👦', sub: 'Junior Explorer' },
    { value: '11-12', label: 'Age 11–12', emoji: '🧑', sub: 'Senior Champion' },
  ]

  return (
    <div className="flex gap-3" role="group" aria-label="Age group">
      {options.map((opt) => {
        const isActive = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(opt.value)}
            style={{
              background: isActive
                ? 'linear-gradient(135deg, #facc15 0%, #eab308 100%)'
                : 'rgba(26,16,53,0.7)',
              border: isActive
                ? '2px solid #facc15'
                : '2px solid rgba(250,204,21,0.25)',
              boxShadow: isActive
                ? '0 0 20px rgba(250,204,21,0.5), 0 4px 16px rgba(0,0,0,0.3)'
                : '0 2px 10px rgba(0,0,0,0.3)',
              transform: isActive ? 'translateY(-2px)' : 'none',
              transition: 'all 0.2s ease',
              color: isActive ? '#1a1035' : '#a89ec4',
            }}
            className="flex flex-1 flex-col items-center gap-1 rounded-card px-4 py-4"
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.border = '2px solid rgba(250,204,21,0.55)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.border = '2px solid rgba(250,204,21,0.25)'
                e.currentTarget.style.transform = 'none'
              }
            }}
          >
            <span className="text-3xl leading-none">{opt.emoji}</span>
            <span
              className="font-heading text-base font-extrabold leading-tight"
              style={{ color: isActive ? '#1a1035' : '#f0e6ff' }}
            >
              {opt.label}
            </span>
            <span
              className="text-xs font-medium"
              style={{ color: isActive ? 'rgba(26,16,53,0.7)' : 'rgba(168,158,196,0.7)' }}
            >
              {opt.sub}
            </span>
          </button>
        )
      })}
    </div>
  )
}
