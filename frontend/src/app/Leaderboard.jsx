const RANKS = [
  { rank: 1, name: 'Aarav S.',  level: 'Senior Champion', sets: 142, accuracy: 94, streak: 28 },
  { rank: 2, name: 'Maya R.',   level: 'Senior Champion', sets: 128, accuracy: 91, streak: 21 },
  { rank: 3, name: 'Liam K.',   level: 'Junior Explorer', sets: 119, accuracy: 89, streak: 17 },
  { rank: 4, name: 'Sofia P.',  level: 'Junior Explorer', sets: 102, accuracy: 88, streak: 14 },
  { rank: 5, name: 'Noah T.',   level: 'Senior Champion', sets:  97, accuracy: 85, streak: 12 },
  { rank: 6, name: 'Zara M.',   level: 'Junior Explorer', sets:  88, accuracy: 84, streak: 11 },
  { rank: 7, name: 'Ethan W.',  level: 'Senior Champion', sets:  81, accuracy: 82, streak:  9 },
  { rank: 8, name: 'Priya N.',  level: 'Junior Explorer', sets:  74, accuracy: 80, streak:  8 },
]

// Podium order: rank2 left, rank1 centre, rank3 right
const PODIUM = [RANKS[1], RANKS[0], RANKS[2]]

const MEDAL = [
  'bg-muted text-ink',
  'bg-accent text-accent-foreground',
  'bg-secondary text-ink-soft',
]

export default function Leaderboard() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <header className="mb-12">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">/ Leaderboard</p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl font-semibold text-ink">
          This week&apos;s most consistent.
        </h1>
        <p className="mt-3 text-ink-soft max-w-2xl">
          Ranked by completed sets, then accuracy. Consistency beats brilliance — show up daily and you&apos;ll be here next week.
        </p>
      </header>

      {/* Podium */}
      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        {PODIUM.map((p, i) => (
          <div
            key={p.rank}
            className={`rounded-2xl bg-card ring-soft p-6 ${i === 0 ? 'pt-10' : i === 1 ? 'pt-4 sm:-mt-4' : 'pt-12'}`}
          >
            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-full font-display text-lg font-semibold ${MEDAL[i]}`}>
              {p.rank}
            </div>
            <h3 className="mt-4 font-display text-xl font-semibold text-ink">{p.name}</h3>
            <p className="text-xs text-muted-foreground">{p.level}</p>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <PodiumStat k={p.sets}        v="Sets"     />
              <PodiumStat k={`${p.accuracy}%`} v="Accuracy" />
              <PodiumStat k={p.streak}      v="Streak"   />
            </div>
          </div>
        ))}
      </div>

      {/* Ranked table */}
      <div className="rounded-2xl bg-card ring-soft overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_140px_100px_100px_80px] gap-4 px-6 py-3 border-b border-border bg-surface-elevated">
          {['Rank','Learner','Level','Sets','Accuracy','Streak'].map((h) => (
            <span key={h} className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono last:text-right">
              {h}
            </span>
          ))}
        </div>
        {RANKS.map((p) => (
          <div
            key={p.rank}
            className="grid grid-cols-[60px_1fr_140px_100px_100px_80px] gap-4 px-6 py-4 border-b border-border last:border-b-0 items-center hover:bg-surface-elevated transition-colors"
          >
            <span className="font-mono text-sm text-ink-soft">#{p.rank}</span>
            <span className="font-display text-base font-semibold text-ink">{p.name}</span>
            <span className="text-xs text-ink-soft">{p.level}</span>
            <span className="text-right font-mono text-sm text-ink">{p.sets}</span>
            <span className="text-right font-mono text-sm text-ink">{p.accuracy}%</span>
            <span className="text-right font-mono text-sm text-ink">{p.streak}d</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PodiumStat({ k, v }) {
  return (
    <div>
      <div className="font-display text-lg font-semibold text-ink">{k}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{v}</div>
    </div>
  )
}
