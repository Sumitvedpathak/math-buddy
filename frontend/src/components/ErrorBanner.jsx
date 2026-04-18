/**
 * ErrorBanner — centred modal overlay shown whenever an AI service call fails.
 * Renders a semi-transparent dark backdrop with a styled card in the centre.
 *
 * @param {Object} props
 * @param {string} props.message - User-facing error message
 * @param {() => void} props.onRetry - Called when the retry button is clicked
 */
export default function ErrorBanner({ message, onRetry }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="error-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />

      {/* Card */}
      <div className="relative w-full max-w-sm rounded-card bg-surface border border-error/40 p-6 shadow-2xl shadow-error/20 space-y-4">
        {/* Icon + title */}
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error/20 text-2xl" aria-hidden="true">
            ⚠️
          </span>
          <h2 id="error-modal-title" className="font-heading text-lg font-bold text-error">
            Something went wrong
          </h2>
        </div>

        <p className="font-body text-sm text-text-secondary leading-relaxed">
          {message}
        </p>

        {onRetry && (
          <button
            onClick={onRetry}
            className="w-full rounded-button bg-error py-2.5 font-heading text-base font-bold text-white shadow hover:opacity-90 active:scale-95 transition"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}
