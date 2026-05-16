/**
 * ErrorBanner — modal overlay for AI service failures.
 * Uses EduSpark destructive palette tokens.
 *
 * @param {{ message: string, onRetry: () => void }} props
 */
export default function ErrorBanner({ message, onRetry }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="error-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" aria-hidden="true" />

      <div role="alert" className="relative w-full max-w-sm rounded-2xl bg-card ring-soft-lg border border-destructive/30 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/15"
            aria-hidden="true"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-destructive">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          <h2 id="error-modal-title" className="font-display text-lg font-semibold text-destructive">
            Error
          </h2>
        </div>

        <p className="text-sm text-ink-soft leading-relaxed">{message}</p>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  )
}
