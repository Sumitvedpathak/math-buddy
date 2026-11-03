import { useState } from 'react'
import { btn } from './Start'

const COMMAND_WORDS = ['Describe', 'Explain', 'Compare', 'Analyse', 'Evaluate', 'Justify']
const FOCUSES = [
  'Historical Significance', 'Cause and Consequence', 'Continuity and Change', 'Historical Perspective',
  'Analysis', 'Inference', "Author's craft", 'Perspective', 'Connection to the world', 'School question',
]

const KIND_LABEL = { card: 'Background', novel: 'Practice text', poem: 'Poem', media: 'Media text' }

export function QuestionCard({ item }) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-card ring-soft p-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Your question</p>
        <p className="mt-3 font-display text-2xl text-ink">{item.question}</p>
      </section>
      <section className="rounded-2xl bg-card ring-soft p-6" aria-label={KIND_LABEL[item.text_kind]}>
        <h2 className="font-display text-lg font-semibold text-ink">{KIND_LABEL[item.text_kind] || 'Background'}</h2>
        {item.text_kind === 'novel' && (
          <p className="mt-2 text-sm text-muted-foreground">
            Answer about your class novel, or use this practice text.
          </p>
        )}
        <p className="mt-3 whitespace-pre-wrap text-ink-soft">{item.background}</p>
        <p className="mt-4 text-sm text-ink-soft">
          <span className="font-mono text-xs uppercase text-muted-foreground">Subject words </span>
          {item.key_terms.join(', ')}
        </p>
      </section>
    </div>
  )
}

/** Step 2 + 3: the question and source, then the decode check. */
export default function QuestionDecode({ session, onDecode, onContinue, decodeResult, busy }) {
  const { item } = session
  const [words, setWords] = useState([])
  const [parts, setParts] = useState(1)
  const [focus, setFocus] = useState('')

  const toggleWord = (w) => setWords((cur) => (cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w]))

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <QuestionCard item={item} />

      <section className="rounded-2xl bg-card ring-soft p-6 space-y-5" aria-label="Decode check">
        <h2 className="font-display text-xl font-semibold text-ink">Decode check</h2>
        <p className="text-ink-soft">Read the question twice. Then tell us what it is asking.</p>

        <fieldset disabled={Boolean(decodeResult)} className="space-y-4">
          <div>
            <legend className="text-sm text-ink">Which command word(s)?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {COMMAND_WORDS.map((w) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={words.includes(w)}
                  onClick={() => toggleWord(w)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    words.includes(w) ? 'border-primary bg-primary/10 text-ink' : 'border-border text-ink-soft hover:bg-muted'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="wc-parts" className="block text-sm text-ink">How many parts must you answer?</label>
            <select
              id="wc-parts"
              value={parts}
              onChange={(e) => setParts(Number(e.target.value))}
              className="mt-2 rounded-md border border-border bg-background p-2 text-ink"
            >
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="wc-focus" className="block text-sm text-ink">What is the thinking focus?</label>
            <select
              id="wc-focus"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              className="mt-2 rounded-md border border-border bg-background p-2 text-ink"
            >
              <option value="">Choose…</option>
              {FOCUSES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </fieldset>

        {!decodeResult && (
          <button
            type="button"
            className={btn}
            disabled={busy || words.length === 0 || !focus}
            onClick={() => onDecode({ command_words: words, parts, thinking_focus: focus })}
          >
            Check my decoding
          </button>
        )}

        {decodeResult && (
          <div className="space-y-2" role="status">
            <ul className="list-none p-0 space-y-1">
              <li className={decodeResult.command_words_correct ? 'text-accent' : 'text-destructive'}>
                Command word: {decodeResult.command_words_correct ? 'right' : `not quite. It was ${decodeResult.answer.command_words.join(' and ')}.`}
              </li>
              <li className={decodeResult.parts_correct ? 'text-accent' : 'text-destructive'}>
                Parts: {decodeResult.parts_correct ? 'right' : `not quite. There ${decodeResult.answer.parts === 1 ? 'is 1 part' : `are ${decodeResult.answer.parts} parts`}.`}
              </li>
              <li className={decodeResult.focus_correct ? 'text-accent' : 'text-destructive'}>
                Thinking focus: {decodeResult.focus_correct ? 'right' : `not quite. It was ${decodeResult.answer.thinking_focus}.`}
              </li>
            </ul>
            <button type="button" className={btn} onClick={onContinue}>Start writing</button>
          </div>
        )}
      </section>
    </div>
  )
}
