/**
 * RACEE colour coding (brief: Restate yellow, Answer green, Cite blue, Explain pink, Extend purple).
 * These five colours are part of the feature's meaning, so they are defined here rather than
 * as theme tokens. Each has a soft background and a readable text colour on the dark theme.
 */
export const STEPS = [
  { key: 'restate', label: 'Restate', bg: 'oklch(0.86 0.15 95 / 0.30)', border: 'oklch(0.86 0.15 95)' },
  { key: 'answer', label: 'Answer', bg: 'oklch(0.78 0.16 150 / 0.30)', border: 'oklch(0.78 0.16 150)' },
  { key: 'cite', label: 'Cite', bg: 'oklch(0.75 0.13 245 / 0.30)', border: 'oklch(0.75 0.13 245)' },
  { key: 'explain', label: 'Explain', bg: 'oklch(0.78 0.14 355 / 0.30)', border: 'oklch(0.78 0.14 355)' },
  { key: 'extend', label: 'Extend', bg: 'oklch(0.72 0.17 300 / 0.30)', border: 'oklch(0.72 0.17 300)' },
]

export const STEP_BY_KEY = Object.fromEntries(STEPS.map((s) => [s.key, s]))

/**
 * Cut the transcript into coloured segments using the Reviewer's sentence tags.
 * Tags are matched in order; text between matches stays plain.
 * @returns {Array<{text: string, tag: string|null}>}
 */
export function colourSegments(transcript, sentenceTags = []) {
  const segments = []
  let cursor = 0
  for (const { sentence, tag } of sentenceTags) {
    const at = transcript.indexOf(sentence, cursor)
    if (at === -1) continue
    if (at > cursor) segments.push({ text: transcript.slice(cursor, at), tag: null })
    segments.push({ text: sentence, tag: tag === 'other' ? null : tag })
    cursor = at + sentence.length
  }
  if (cursor < transcript.length) segments.push({ text: transcript.slice(cursor), tag: null })
  return segments
}

/** Steps with no sentence tagged: a missing colour shows a missing step. */
export function missingSteps(sentenceTags = []) {
  const used = new Set(sentenceTags.map((t) => t.tag))
  return STEPS.filter((s) => !used.has(s.key))
}

export const SUBJECT_LABEL = { history: 'History', language: 'Language', school: 'School question' }
