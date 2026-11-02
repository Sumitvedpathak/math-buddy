import { useEffect, useState } from 'react'
import { wcParent } from './wcApi'
import { SUBJECT_LABEL } from './colours'

const dateFmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
const levelText = (r) => (r ? `${r.level} (${r.percent}%)` : '—')

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
      <div>
        <label htmlFor="wc-rubric" className="block text-sm text-ink-soft">
          Teacher&apos;s rubric or success criteria (used on his reminder screen and by the marker)
        </label>
        <textarea id="wc-rubric" rows={5} maxLength={6000} value={form.rubric_override || ''}
          onChange={(e) => set({ rubric_override: e.target.value })}
          className="mt-2 w-full rounded-md border border-border bg-background p-3 text-ink" />
      </div>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Save settings</button>
        {saved && <span role="status" className="text-sm text-ink-soft">Saved.</span>}
      </div>
    </form>
  )
}

/** Parent view: which tests were done and the level the Reviewer gave. Nothing more. */
export default function WritingCoachPanel({ token, profileId }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    wcParent.sessions(token, profileId).then(setRows).catch(() => setError(true))
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
                    <td className="py-2 pr-4">{r.question}</td>
                    <td className="py-2 pr-4 whitespace-nowrap text-ink">{levelText(r.draft)}</td>
                    <td className="py-2 whitespace-nowrap text-ink">{levelText(r.rewrite)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Settings token={token} profileId={profileId} />
    </section>
  )
}
