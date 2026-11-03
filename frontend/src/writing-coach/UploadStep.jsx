import { useMemo, useRef, useState } from 'react'
import { btn, btnGhost } from './Start'
import { canvasToDataUri, fileToCanvas, renderPage } from './image'

const NO_TRIM = { top: 0, bottom: 0, left: 0, right: 0 }
const MAX_PAGES = 6

function PagePreview({ page, index, onRotate, onTrim, onRemove }) {
  const url = useMemo(
    () => canvasToDataUri(renderPage(page.source, page.rotation, page.trim)),
    [page.source, page.rotation, page.trim]
  )
  return (
    <li className="rounded-2xl bg-card ring-soft p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">Page {index + 1}</h3>
        <button type="button" className="text-sm text-destructive" onClick={onRemove}>Remove</button>
      </div>
      <img src={url} alt={`Page ${index + 1} preview`} className="mx-auto max-h-80 rounded-md" />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnGhost} onClick={() => onRotate(-90)}>Rotate left</button>
        <button type="button" className={btnGhost} onClick={() => onRotate(90)}>Rotate right</button>
      </div>
      <details className="text-sm text-ink-soft">
        <summary className="cursor-pointer">Trim the edges</summary>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {['top', 'bottom', 'left', 'right'].map((side) => (
            <label key={side} className="flex flex-col gap-1 capitalize">
              {side}
              <input
                type="range"
                min="0"
                max="40"
                value={Math.round(page.trim[side] * 100)}
                onChange={(e) => onTrim(side, Number(e.target.value) / 100)}
              />
            </label>
          ))}
        </div>
      </details>
    </li>
  )
}

/** Step 5: camera or file upload, several pages, rotate and trim. Everything stays in the browser. */
export default function UploadStep({ title, onRead, busy, error }) {
  const [pages, setPages] = useState([])
  const [problem, setProblem] = useState(null)
  const nextId = useRef(0)

  async function addFiles(fileList) {
    setProblem(null)
    for (const file of Array.from(fileList)) {
      if (pages.length >= MAX_PAGES) break
      try {
        const source = await fileToCanvas(file)
        setPages((cur) => (cur.length >= MAX_PAGES ? cur : [...cur, { id: nextId.current++, source, rotation: 0, trim: NO_TRIM }]))
      } catch (err) {
        setProblem(err.message)
      }
    }
  }

  const update = (id, patch) => setPages((cur) => cur.map((p) => (p.id === id ? { ...p, ...patch(p) } : p)))

  function submit() {
    const images = pages.map((p) => canvasToDataUri(renderPage(p.source, p.rotation, p.trim)))
    onRead(images)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">/ Upload</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink">{title}</h1>
        <p className="mt-3 text-ink-soft">
          Take a clear photo of each page, in order. Photos are used only to read your writing and are not saved.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <label className={`${btn} cursor-pointer`}>
          Take a photo
          <input type="file" accept="image/*" capture="environment" className="sr-only"
            onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        </label>
        <label className={`${btnGhost} cursor-pointer`}>
          Choose photos
          <input type="file" accept="image/*" multiple className="sr-only"
            onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        </label>
      </div>

      {(problem || error) && <p role="alert" className="text-destructive">{problem || error}</p>}

      <ul className="space-y-4 list-none p-0">
        {pages.map((p, i) => (
          <PagePreview
            key={p.id}
            page={p}
            index={i}
            onRotate={(deg) => update(p.id, (cur) => ({ rotation: (cur.rotation + deg + 360) % 360 }))}
            onTrim={(side, v) => update(p.id, (cur) => ({ trim: { ...cur.trim, [side]: v } }))}
            onRemove={() => setPages((cur) => cur.filter((x) => x.id !== p.id))}
          />
        ))}
      </ul>

      <button type="button" className={btn} disabled={pages.length === 0 || busy} onClick={submit}>
        {busy ? 'Reading your writing…' : `Read my writing (${pages.length} ${pages.length === 1 ? 'page' : 'pages'})`}
      </button>
    </div>
  )
}
