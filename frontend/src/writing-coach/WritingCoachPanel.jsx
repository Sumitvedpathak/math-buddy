import { useEffect, useState } from 'react'
import { wcParent } from './wcApi'
import { CRITERIA_LABELS, SUBJECT_LABEL } from './colours'

const dateFmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
const levelText = (r) => (r ? `${r.level} (${r.percent}%)` : '—')
const shortDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

function Settings({ token, profileId }) {
  const [form, setForm] = useState(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    wcParent.getSettings(token, profileId).then(setForm).catch(() => setError('Could not load settings.'))
  }, [token, profileId])

  if (!form) return error ? <p role="alert" className="text-destructive">{error}</p> : null

  const set = (patch) => { setSaved(false); setForm((f) => ({ ...f, ...patch })) }
  async function save(e) {
    e.preventDefault()
    setError(null)
    try {
      setForm(await wcParent.putSettings(token, profileId, form))
      setSaved(true)
    } catch {
      setError('Could not save settings.')
    }
  }

  return (
    <form onSubmit={save} className="mt-6 space-y-4" aria-label="Writing Coach settings">
      <h3 className="font-display text-lg font-semibold text-ink">Settings</h3>
      <div className="flex flex-wrap gap-4">
        <label className="text-sm text-ink-soft">
          History strand
          <select id="wc-strand" value={form.history_strand} onChange={(e) => set({ history_strand: e.target.value })}
            className="ml-2 rounded-md border border-border bg-background p-2 text-ink">
            <option value="A">A: New France and British North America, 1713–1800</option>
            <option value="B">B: Canada, 1800–1850</option>
            <option value="both">Both</option>
          </select>
        </label>
        <label className="text-sm text-ink-soft">
          Focus week
          <select id="wc-week" value={form.focus_week} onChange={(e) => set({ focus_week: Number(e.target.value) })}
            className="ml-2 rounded-md border border-border bg-background p-2 text-ink">
            {[1, 2, 3, 4].map((w) => <option key={w} value={w}>Week {w}</option>)}
          </select>
        </label>
      </div>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Save settings</button>
        {saved && <span role="status" className="text-sm text-ink-soft">Saved.</span>}
      </div>
    </form>
  )
}

/** Draft marks per criterion over time, so a parent can see which one is holding him back. */
function CriteriaTrend({ data }) {
  if (!data || (data.trend.length === 0 && data.top_errors.length === 0)) return null
  const { trend, averages, lowest, top_errors: topErrors } = data
  const cell = 'py-2 pr-4 whitespace-nowrap'
  return (
    <div className="mt-6 space-y-4">
      {trend.length > 0 && (
        <div>
          <h3 className="font-display text-lg font-semibold text-ink">The three criteria over time</h3>
          <p className="text-sm text-muted-foreground">Draft marks only, for his latest {trend.length} {trend.length === 1 ? 'draft' : 'drafts'}, oldest first</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm" aria-label="Marks for each criterion">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Criterion</th>
                  {trend.map((t, i) => <th key={i} className={`${cell} font-medium`}>{shortDate.format(new Date(t.date))}</th>)}
                  <th className="py-2 font-medium">Average</th>
                </tr>
              </thead>
              <tbody className="text-ink-soft">
                {Object.entries(CRITERIA_LABELS).map(([key, label]) => (
                  <tr key={key} className="border-t border-border">
                    <th scope="row" className={`${cell} font-medium text-ink`}>{label}</th>
                    {trend.map((t, i) => <td key={i} className={cell}>{t[key].level}</td>)}
                    <td className={`py-2 whitespace-nowrap ${key === lowest ? 'font-semibold text-primary' : ''}`}>
                      {averages[key]}%{key === lowest && ' lowest'}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border">
                  <th scope="row" className={`${cell} font-medium text-ink`}>Overall</th>
                  {trend.map((t, i) => <td key={i} className={cell}>{t.overall.level}{t.cap_applied && ' capped'}</td>)}
                  <td className="py-2">{averages.overall}%</td>
                </tr>
                <tr className="border-t border-border">
                  <th scope="row" className={`${cell} font-medium text-ink`}>Draft mistakes fixed</th>
                  {trend.map((t, i) => (
                    <td key={i} className={cell}>{t.errors_flagged > 0 ? `${t.errors_fixed} of ${t.errors_flagged}` : '—'}</td>
                  ))}
                  <td className="py-2" />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      {topErrors.length > 0 && (
        <div>
          <p className="text-sm text-muted-foreground">Most common mistakes</p>
          <ul className="mt-2 list-disc pl-5 text-ink-soft">
            {topErrors.map((e) => <li key={e.category}>{e.label}: {e.count}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function Corrections({ corrections }) {
  const changes = corrections.flatMap((c) => c.changes.map((ch) => ({ ...ch, kind: c.kind })))
  if (changes.length === 0) return null
  return (
    <details className="mt-1 text-xs">
      <summary className="cursor-pointer text-muted-foreground">
        He changed {changes.length} {changes.length === 1 ? 'word' : 'words'} while checking the text
      </summary>
      <ul className="mt-1 list-none p-0">
        {changes.map((ch, i) => (
          <li key={i} className="text-ink-soft">
            {ch.kind}: “{ch.before}” → “{ch.after}”{ch.suspect && <span className="ml-1 text-destructive">(looks like a spelling fix)</span>}
          </li>
        ))}
      </ul>
    </details>
  )
}

/** Parent view: tests done, levels, the three-criteria trend and common mistakes, and any text he changed. */
export default function WritingCoachPanel({ token, profileId }) {
  const [rows, setRows] = useState(null)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    wcParent.sessions(token, profileId).then(setRows).catch(() => setError(true))
    wcParent.progress(token, profileId).then(setProgress).catch(() => setProgress(null))
  }, [token, profileId])

  return (
    <section className="rounded-2xl bg-card ring-soft p-6" aria-label="Writing Coach">
      <h2 className="font-display text-2xl font-semibold text-ink">Writing Coach</h2>
      <div className="mt-4">
        {error && <p role="alert" className="text-destructive">Could not load Writing Coach.</p>}
        {!rows && !error && <p className="text-ink-soft">Loading…</p>}
        {rows && rows.length === 0 && <p className="text-ink-soft">No Writing Coach practice yet.</p>}
        {rows && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Subject</th>
                  <th className="py-2 pr-4 font-medium">Question</th>
                  <th className="py-2 pr-4 font-medium">Draft level</th>
                  <th className="py-2 font-medium">Rewrite level</th>
                </tr>
              </thead>
              <tbody className="text-ink-soft">
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="py-2 pr-4 whitespace-nowrap">{dateFmt.format(new Date(r.created_at))}</td>
                    <td className="py-2 pr-4">{SUBJECT_LABEL[r.subject]}</td>
                    <td className="py-2 pr-4">
                      {r.question}
                      {r.corrections?.length > 0 && <Corrections corrections={r.corrections} />}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap text-ink">{levelText(r.draft)}</td>
                    <td className="py-2 whitespace-nowrap text-ink">{levelText(r.rewrite)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <CriteriaTrend data={progress} />
      <Settings token={token} profileId={profileId} />
    </section>
  )
}
