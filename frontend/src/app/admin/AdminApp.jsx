import { useEffect, useState } from 'react'
import { adminGet } from '../../lib/api'
import { theme, setTheme } from '../../themes/dandysWorld'

const WEEKS_SHOWN = 12

/** Token from /admin/<token>, or null when the path is not an admin path. */
export function adminTokenFromPath(pathname) {
  const match = /^\/admin\/([^/]+)\/?$/.exec(pathname)
  return match ? decodeURIComponent(match[1]) : null
}

/** Small fetch hook: { data, error, loading }. error.status === 404 means "not found / bad token". */
function useAdminData(token, path) {
  const [result, setResult] = useState({ data: null, error: null, loading: true })
  useEffect(() => {
    if (!path) return undefined
    let cancelled = false
    setResult({ data: null, error: null, loading: true })
    adminGet(token, path)
      .then((data) => !cancelled && setResult({ data, error: null, loading: false }))
      .catch((error) => !cancelled && setResult({ data: null, error, loading: false }))
    return () => { cancelled = true }
  }, [token, path])
  return result
}

function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-ink-soft">
      <p>Page not found.</p>
    </main>
  )
}

export default function AdminApp({ token }) {
  const [selected, setSelected] = useState(null)
  const profiles = useAdminData(token, '/profiles')

  useEffect(() => {
    setTheme(theme)
  }, [])

  // A wrong token gets the same blank "not found" as any unknown page.
  if (profiles.error?.status === 404) return <NotFound />

  return (
    <div id="theme-root" className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-10">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">/ Parent dashboard</p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-ink">Math Buddy progress</h1>
        </header>

        {profiles.loading && <p className="text-ink-soft">Loading…</p>}
        {profiles.error && profiles.error.status !== 404 && (
          <p role="alert" className="text-destructive">Could not load profiles.</p>
        )}

        {profiles.data && (
          <ProfileList profiles={profiles.data} selectedId={selected?.id} onSelect={setSelected} />
        )}
        {selected && <ProfileDetail key={selected.id} token={token} profile={selected} />}
      </main>
    </div>
  )
}

function ProfileList({ profiles, selectedId, onSelect }) {
  if (profiles.length === 0) return <p className="text-ink-soft">No children have signed up yet.</p>
  return (
    <section aria-label="Children">
      <h2 className="font-display text-2xl font-semibold text-ink">Children</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 list-none p-0">
        {profiles.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSelect(p)}
              aria-pressed={p.id === selectedId}
              className={[
                'w-full text-left rounded-xl border p-4 transition-all',
                p.id === selectedId
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border bg-card hover:border-ink/20',
              ].join(' ')}
            >
              <span className="font-display text-lg font-semibold text-ink">{p.display_name}</span>
              <span className="ml-2 text-xs text-muted-foreground">Grade {p.grade}</span>
              <p className="mt-1 text-xs text-ink-soft break-all">{p.email}</p>
              <p className="mt-2 text-xs text-ink-soft">
                {p.attempt_count} {p.attempt_count === 1 ? 'attempt' : 'attempts'}
                {p.last_attempt_at ? ` · last ${new Date(p.last_attempt_at).toLocaleDateString()}` : ''}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ProfileDetail({ token, profile }) {
  const base = `/profiles/${profile.id}`
  const daily = useAdminData(token, `${base}/progress/daily`)
  const attempts = useAdminData(token, `${base}/attempts`)
  const lessons = useAdminData(token, `${base}/lesson-progress`)

  return (
    <div className="space-y-10" aria-label={`Progress for ${profile.display_name}`}>
      <Panel title={`${profile.display_name} — daily progress`} state={daily}>
        {(rows) => <DailyCalendar days={rows} />}
      </Panel>
      <Panel title="Lesson mastery" state={lessons}>
        {(rows) => <LessonGrid lessons={rows} />}
      </Panel>
      <Panel title="Attempt history" state={attempts}>
        {(rows) => <AttemptTable attempts={rows} />}
      </Panel>
    </div>
  )
}

function Panel({ title, state, children }) {
  return (
    <section className="rounded-2xl bg-card ring-soft p-6">
      <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
      <div className="mt-4">
        {state.loading && <p className="text-ink-soft">Loading…</p>}
        {state.error && <p role="alert" className="text-destructive">Could not load this section.</p>}
        {state.data && children(state.data)}
      </div>
    </section>
  )
}

/** GitHub-style grid: one column per week, one row per weekday, last WEEKS_SHOWN weeks (UTC days). */
function DailyCalendar({ days }) {
  const byDate = Object.fromEntries(days.map((d) => [d.date, d]))
  const today = new Date()
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const dayMs = 86_400_000
  // First cell is the Sunday WEEKS_SHOWN-1 weeks before this week's Sunday.
  const thisSunday = todayUtc - new Date(todayUtc).getUTCDay() * dayMs
  const first = thisSunday - (WEEKS_SHOWN - 1) * 7 * dayMs
  const grid = Array.from({ length: WEEKS_SHOWN * 7 }, (_, i) => first + i * dayMs)

  const shade = (count) =>
    count === 0 ? 'bg-muted'
      : count === 1 ? 'bg-primary/30'
        : count <= 3 ? 'bg-primary/60'
          : 'bg-primary'

  return (
    <div>
      <div
        className="grid grid-flow-col grid-rows-7 gap-1 w-fit"
        role="img"
        aria-label={`Practice activity over the last ${WEEKS_SHOWN} weeks`}
      >
        {grid.map((t) => {
          const key = new Date(t).toISOString().slice(0, 10)
          const d = byDate[key]
          const future = t > todayUtc
          return (
            <div
              key={key}
              title={d ? `${key}: ${d.attempt_count} attempts, avg ${d.avg_score_pct}%` : key}
              className={`h-4 w-4 rounded-sm ${future ? 'opacity-0' : shade(d?.attempt_count ?? 0)}`}
            />
          )
        })}
      </div>
      {days.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">No practice yet.</p>
      ) : (
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-4">Day</th>
              <th className="py-2 pr-4">Attempts</th>
              <th className="py-2 pr-4">Lessons / Free</th>
              <th className="py-2 pr-4">Avg</th>
              <th className="py-2">Best</th>
            </tr>
          </thead>
          <tbody>
            {days.slice(0, 14).map((d) => (
              <tr key={d.date} className="border-t border-border">
                <td className="py-2 pr-4 font-mono">{d.date}</td>
                <td className="py-2 pr-4">{d.attempt_count}</td>
                <td className="py-2 pr-4">{d.curriculum_attempts} / {d.adhoc_attempts}</td>
                <td className="py-2 pr-4">{d.avg_score_pct}%</td>
                <td className="py-2">{d.best_score_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function LessonGrid({ lessons }) {
  const units = []
  for (const l of lessons) {
    let unit = units.find((u) => u.id === l.unit_id)
    if (!unit) {
      unit = { id: l.unit_id, title: l.unit_title, lessons: [] }
      units.push(unit)
    }
    unit.lessons.push(l)
  }
  const mastered = lessons.filter((l) => l.completed).length

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-soft">{mastered} of {lessons.length} lessons mastered.</p>
      {units.map((unit) => (
        <div key={unit.id}>
          <h3 className="text-sm font-medium text-ink">{unit.title}</h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 list-none p-0">
            {unit.lessons.map((l) => (
              <li
                key={l.lesson_id}
                className={[
                  'rounded-lg border p-3 text-sm',
                  l.completed
                    ? 'border-success/40 bg-success/10'
                    : l.attempts_count > 0
                      ? 'border-border bg-surface-elevated'
                      : 'border-border bg-surface',
                ].join(' ')}
              >
                <span className="font-mono text-xs text-muted-foreground mr-2">{l.lesson_id}</span>
                <span className="text-ink">{l.lesson_title}</span>
                <p className="mt-1 text-xs text-ink-soft">
                  {l.completed ? '✓ Mastered · ' : ''}
                  {l.attempts_count > 0
                    ? `best ${l.best_score_pct}% · ${l.attempts_count} ${l.attempts_count === 1 ? 'try' : 'tries'}`
                    : 'not started'}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function AttemptTable({ attempts }) {
  if (attempts.length === 0) return <p className="text-sm text-ink-soft">No attempts yet.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="py-2 pr-4">When</th>
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Lesson / topic</th>
            <th className="py-2 pr-4">Score</th>
            <th className="py-2">%</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((a) => (
            <tr key={a.id} className="border-t border-border">
              <td className="py-2 pr-4 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
              <td className="py-2 pr-4">{a.mode === 'curriculum' ? 'Lesson' : 'Free practice'}</td>
              <td className="py-2 pr-4">{a.lesson_id ?? a.topic_id}</td>
              <td className="py-2 pr-4 font-mono">{a.score} / {a.max_score}</td>
              <td className="py-2">{a.score_pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
