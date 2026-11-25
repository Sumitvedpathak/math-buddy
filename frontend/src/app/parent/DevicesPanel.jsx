import { useEffect, useState } from 'react'
import { listDevices, renameDevice, unlinkDevice } from '../../lib/api'

const quietButton = 'rounded-md px-3 py-1.5 text-sm text-ink-soft hover:bg-muted disabled:opacity-40'
const dangerButton =
  'rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-40'

function formatDay(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** The devices signed in as one child: rename or unlink each. */
export default function DevicesPanel({ child, onUnlinked, onClose, onError }) {
  const [devices, setDevices] = useState(null) // null while loading

  useEffect(() => {
    let cancelled = false
    listDevices(child.id)
      .then((list) => !cancelled && setDevices(list))
      .catch((err) => {
        console.error('[devices] error:', err)
        if (!cancelled) {
          setDevices([])
          onError('Could not load the devices. Please try again.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [child.id, onError])

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink">Devices signed in as {child.display_name}</p>
        <button type="button" onClick={onClose} className={quietButton}>
          Close
        </button>
      </div>
      {devices === null ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <ul aria-label={`${child.display_name}'s devices`} className="space-y-2 list-none p-0">
          {devices.map((device) => (
            <DeviceItem
              key={device.id}
              device={device}
              onRenamed={(updated) => setDevices((list) => list.map((d) => (d.id === updated.id ? updated : d)))}
              onUnlinked={() => {
                setDevices((list) => list.filter((d) => d.id !== device.id))
                onUnlinked()
              }}
              onError={onError}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function DeviceItem({ device, onRenamed, onUnlinked, onError }) {
  const [mode, setMode] = useState('view') // 'view' | 'rename' | 'confirmUnlink'
  const [name, setName] = useState(device.name)
  const [busy, setBusy] = useState(false)

  async function run(action, failMessage) {
    setBusy(true)
    try {
      await action()
    } catch (err) {
      console.error('[device] error:', err)
      onError(failMessage)
    } finally {
      setBusy(false)
    }
  }

  function save(e) {
    e.preventDefault()
    run(async () => {
      onRenamed(await renameDevice(device.id, name.trim()))
      setMode('view')
    }, 'Could not rename the device. Please try again.')
  }

  function unlink() {
    run(async () => {
      await unlinkDevice(device.id)
      onUnlinked()
    }, 'Could not unlink the device. Please try again.')
  }

  if (mode === 'rename') {
    return (
      <li className="rounded-md bg-surface px-3 py-2">
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <input
            aria-label={`New name for ${device.name}`}
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 min-w-[10rem] rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button type="submit" disabled={busy || !name.trim()} className={quietButton}>
            Save
          </button>
          <button type="button" onClick={() => setMode('view')} className={quietButton}>
            Cancel
          </button>
        </form>
      </li>
    )
  }

  return (
    <li className="rounded-md bg-surface px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-ink">{device.name}</p>
          <p className="text-xs text-ink-soft">
            Linked {formatDay(device.createdAt)} · last used {formatDay(device.lastUsedAt)}
          </p>
        </div>
        {mode === 'view' && (
          <div className="flex gap-1">
            <button
              type="button"
              aria-label={`Rename ${device.name}`}
              onClick={() => {
                setName(device.name)
                setMode('rename')
              }}
              className={quietButton}
            >
              Rename
            </button>
            <button
              type="button"
              aria-label={`Unlink ${device.name}`}
              onClick={() => setMode('confirmUnlink')}
              className={quietButton}
            >
              Unlink
            </button>
          </div>
        )}
      </div>
      {mode === 'confirmUnlink' && (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-ink">
            Unlink {device.name}? It is signed out and needs a new code to get back in.
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={unlink} className={dangerButton}>
              Yes, unlink
            </button>
            <button type="button" onClick={() => setMode('view')} className={quietButton}>
              Keep
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
