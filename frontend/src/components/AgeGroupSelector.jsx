/**
 * AgeGroupSelector — two-button toggle between "Age 9–10" and "Age 11–12".
 *
 * @param {Object} props
 * @param {"9-10"|"11-12"} props.value - currently selected age group
 * @param {(value: string) => void} props.onChange - called with the new value on click
 */
export default function AgeGroupSelector({ value, onChange }) {
  const options = [
    { value: '9-10', label: 'Age 9–10' },
    { value: '11-12', label: 'Age 11–12' },
  ]

  return (
    <div className="flex gap-2" role="group" aria-label="Age group">
      {options.map((opt) => {
        const isActive = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(opt.value)}
            className={[
              'rounded-button px-5 py-2 font-semibold text-sm transition',
              isActive
                ? 'bg-primary text-text-primary shadow-md'
                : 'bg-surface border border-primary/40 text-text-secondary hover:bg-primary/20',
            ].join(' ')}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
