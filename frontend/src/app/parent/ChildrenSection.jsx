import { useEffect, useState } from 'react'
import { addChild, createLinkCode, updateChild } from '../../lib/api'

const GRADES = ['6', '7']
const inputClass =
  'w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-primary/40'
const primaryButton =
  'inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground ring-soft-lg transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed'
const quietButton = 'rounded-md px-3 py-2 text-sm text-ink-soft hover:bg-muted disabled:opacity-40'

/** The parent's children: list, add, edit name/grade, and link a device. */
export default function ChildrenSection({ initialChildren }) {
  const [children, setChildren] = useState(initialChildren)
  const [message, setMessage] = useState(null)

  function replaceChild(updated) {
    setChildren((list) => list.map((c) => (c.id === updated.id ? updated : c)))
  }

  return (
    <section aria-labelledby="children-title" className="space-y-5">
      <h2 id="children-title" className="font-display text-2xl font-semibold text-ink">Your children</h2>

      {children.length === 0 ? (
        <p className="text-sm text-ink-soft">No children yet. Add each child below.</p>
      ) : (
        <ul aria-label="Your children" className="space-y-2 list-none p-0">
          {children.map((child) => (
            <ChildRow
              key={child.id}
              child={child}
              onSaved={replaceChild}
              onError={(text) => setMessage(text ?? 'Could not save. Please try again.')}
            />
          ))}
        </ul>
      )}

      <AddChildForm
        onAdded={(child) => {
          setMessage(null)
          setChildren((list) => [...list, child])
        }}
        onError={() => setMessage('Could not save. Please try again.')}
      />

      {message && (
        <p role="alert" className="text-sm text-destructive">{message}</p>
      )}
    </section>
  )
}

function ChildRow({ child, onSaved, onError }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(child.display_name)
  const [grade, setGrade] = useState(child.grade)
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      onSaved(await updateChild(child.id, { displayName: name.trim(), grade }))
      setEditing(false)
    } catch (err) {
      console.error('[update child] error:', err)
      onError()
    } finally {
      setBusy(false)
    }
  }

  const [linkCode, setLinkCode] = useState(null) // { code, expiresAt } while shown

  async function makeLinkCode() {
    setBusy(true)
    try {
      setLinkCode(await createLinkCode(child.id))
    } catch (err) {
      console.error('[link code] error:', err)
      onError(
        err?.status === 429
          ? 'Too many codes in the last hour. Please try again later.'
          : 'Could not make a code. Please try again.'
      )
    } finally {
      setBusy(false)
    }
  }

  if (!editing) {
    return (
      <li className="rounded-xl border border-border bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium text-ink">{child.display_name}</p>
            <p className="text-xs text-ink-soft">Grade {child.grade}</p>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              aria-label={`Link a device for ${child.display_name}`}
              disabled={busy}
              onClick={makeLinkCode}
              className={quietButton}
            >
              Link a device
            </button>
            <button
              type="button"
              aria-label={`Edit ${child.display_name}`}
              onClick={() => {
                setName(child.display_name)
                setGrade(child.grade)
                setEditing(true)
              }}
              className={quietButton}
            >
              Edit
            </button>
          </div>
        </div>
        {linkCode && (
          <LinkCodePanel
            childName={child.display_name}
            code={linkCode.code}
            expiresAt={linkCode.expiresAt}
            onDone={() => setLinkCode(null)}
            onNewCode={makeLinkCode}
          />
        )}
      </li>
    )
  }

  return (
    <li className="rounded-xl border border-primary/40 bg-surface px-4 py-3">
      <form onSubmit={save} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[10rem]">
          <input
            aria-label={`Name for ${child.display_name}`}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <select
          aria-label={`Grade for ${child.display_name}`}
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-ink"
        >
          {GRADES.map((g) => (
            <option key={g} value={g}>Grade {g}</option>
          ))}
        </select>
        <button type="submit" disabled={busy || !name.trim()} className={primaryButton}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => setEditing(false)} className={quietButton}>
          Cancel
        </button>
      </form>
    </li>
  )
}

function AddChildForm({ onAdded, onError }) {
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('7')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      onAdded(await addChild({ displayName: name.trim(), grade }))
      setName('')
    } catch (err) {
      console.error('[add child] error:', err)
      onError()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-dashed border-border p-4 space-y-4">
      <div>
        <label htmlFor="new-child-name" className="block text-sm font-medium text-ink">
          Child&apos;s name
        </label>
        <input
          id="new-child-name"
          value={name}
          maxLength={80}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
          className={`mt-2 ${inputClass}`}
        />
        <p className="mt-1 text-xs text-muted-foreground">A first name or nickname is enough.</p>
      </div>
      <fieldset>
        <legend className="block text-sm font-medium text-ink">Grade</legend>
        <div className="mt-2 flex gap-4">
          {GRADES.map((g) => (
            <label key={g} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="new-child-grade"
                value={g}
                checked={grade === g}
                onChange={() => setGrade(g)}
                className="accent-primary"
              />
              Grade {g}
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" disabled={busy || !name.trim()} className={primaryButton}>
        {busy ? 'Adding…' : 'Add child'}
      </button>
    </form>
  )
}

function secondsLeft(expiresAt) {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000))
}

/** The one-time code, big, with a countdown. The child types it on their own device. */
function LinkCodePanel({ childName, code, expiresAt, onDone, onNewCode }) {
  const [left, setLeft] = useState(() => secondsLeft(expiresAt))

  useEffect(() => {
    setLeft(secondsLeft(expiresAt))
    const timer = setInterval(() => setLeft(secondsLeft(expiresAt)), 1000)
    return () => clearInterval(timer)
  }, [expiresAt])

  const minutes = Math.floor(left / 60)
  const seconds = String(left % 60).padStart(2, '0')

  return (
    <div
      role="region"
      aria-label={`Link code for ${childName}`}
      className="mt-3 rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-3"
    >
      <p className="text-sm text-ink">
        On {childName}&apos;s device, open Math Buddy and type this code under
        <strong> Code from your parent</strong>:
      </p>
      {left > 0 ? (
        <>
          <p className="font-mono text-4xl font-semibold tracking-[0.15em] text-ink" aria-live="polite">
            {code}
          </p>
          <p className="text-xs text-ink-soft">
            Works once. Expires in <span className="font-mono">{minutes}:{seconds}</span>.
          </p>
        </>
      ) : (
        <p className="text-sm text-ink-soft">This code has expired.</p>
      )}
      <div className="flex gap-2">
        {left === 0 && (
          <button type="button" onClick={onNewCode} className={primaryButton}>
            Make a new code
          </button>
        )}
        <button type="button" onClick={onDone} className={quietButton}>
          Done
        </button>
      </div>
    </div>
  )
}
