/**
 * ErrorBanner — shared themed error card shown whenever an AI service call fails.
 *
 * @param {Object} props
 * @param {string} props.message - User-facing error message
 * @param {() => void} props.onRetry - Called when the retry button is clicked
 */
export default function ErrorBanner({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-card border border-error/30 bg-error/10 p-4 text-error"
    >
      <span className="text-xl" aria-hidden="true">⚠️</span>
      <div className="flex-1">
        <p className="font-body font-semibold">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-2 rounded-button bg-error px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 active:scale-95 transition"
        >
          Try Again
        </button>
      )}
    </div>
  )
}
