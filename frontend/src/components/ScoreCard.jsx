/**
 * ScoreCard — displays the score for a single topic.
 *
 * @param {Object} props
 * @param {string} props.topic
 * @param {number} props.score
 * @param {number} props.maxScore
 * @param {number} props.questionCount
 */
export default function ScoreCard({ topic, score, maxScore, questionCount }) {
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0

  return (
    <div className="rounded-card bg-surface p-5 shadow-md space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-bold text-text-primary">{topic}</h3>
        <span className="font-heading text-lg font-extrabold text-primary">
          {score} / {maxScore}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-3 w-full overflow-hidden rounded-full bg-primary/20">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
          aria-hidden="true"
        />
      </div>

      <p className="text-xs text-text-secondary">{questionCount} question{questionCount !== 1 ? 's' : ''}</p>
    </div>
  )
}
