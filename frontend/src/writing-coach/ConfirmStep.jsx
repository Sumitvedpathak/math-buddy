import { useState } from 'react'
import { btn } from './Start'

/** Step 6: photo beside the text the app read. He may fix misread words only. */
export default function ConfirmStep({ images, transcript, onConfirm, busy, error }) {
  const [text, setText] = useState(transcript)
  const illegible = (text.match(/\[illegible\]/g) || []).length
  const changed = text !== transcript

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 space-y-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">/ Check the text</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink">Did we read your writing correctly?</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          The text is exactly what we read, mistakes and all. Fix only the words we got wrong. Do not fix your own spelling, capitals or punctuation here, because your review will point those out. Do not add anything new. If we were not sure about a capital letter we put [?] after the word; you can leave it.
          {illegible > 0 && ` Words we could not read are marked [illegible]. There ${illegible === 1 ? 'is 1' : `are ${illegible}`}.`}
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-label="Your photo" className="space-y-3">
          {images && images.length > 0 ? (
            images.map((src, i) => (
              <img key={i} src={src} alt={`Your page ${i + 1}`} className="w-full rounded-md ring-soft" />
            ))
          ) : (
            <p className="rounded-2xl bg-card ring-soft p-6 text-ink-soft">
              The photo is not on this screen any more. Check the text below against your paper.
            </p>
          )}
        </section>
        <section aria-label="What we read" className="space-y-3">
          <label htmlFor="wc-transcript" className="sr-only">What we read</label>
          <textarea
            id="wc-transcript"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            rows={18}
            className="w-full rounded-md border border-border bg-background p-3 font-mono text-sm text-ink"
          />
          {error && <p role="alert" className="text-destructive">{error}</p>}
          <button type="button" className={btn} disabled={busy || !text.trim()} onClick={() => onConfirm(text)}>
            {busy ? 'Marking your answer…' : changed ? 'Save my fixes and mark it' : 'This is right. Mark it'}
          </button>
        </section>
      </div>
    </div>
  )
}
