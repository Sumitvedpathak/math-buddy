import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionContext } from '../context/SessionContext'
import WritingCoach, { stepFromReport } from './WritingCoach'
import Report from './Report'
import Start, { CRITERIA } from './Start'
import WritingCoachPanel from './WritingCoachPanel'
import { colourSegments, missingSteps } from './colours'
import { wc, wcParent } from './wcApi'

vi.mock('./wcApi', () => ({
  wc: {
    reminder: vi.fn(), createSession: vi.fn(), decode: vi.fn(), report: vi.fn(),
    listSessions: vi.fn(), overview: vi.fn(),
  },
  wcParent: { sessions: vi.fn(), getSettings: vi.fn(), putSettings: vi.fn() },
}))

const ITEM = {
  question: 'Explain why the Expulsion of the Acadians in 1755 was a turning point.',
  command_words: ['Explain'], parts: 1, thinking_focus: 'Cause and Consequence',
  background: 'In 1755 British officials ordered Acadians to leave Nova Scotia by ship.',
  key_terms: ['Acadian', 'Expulsion', 'deportation', 'Mi\'kmaw'],
  extend_hints: ['a', 'b'], text_kind: 'card',
}
const REMINDER = {
  focus_week: 2, focus_title: 'Cite and Explain', focus_text: 'Use two pieces of evidence.',
  last_next_time: 'Use two dates', rubric_override: null, suggested_subject: 'history',
  is_rest_day: false, history_strand: 'A',
}
const REVIEW = {
  level: '3-', percent: 72, summary: 'You answered clearly.', allPartsAnswered: false,
  missedParts: ['Why it mattered today'],
  scores: {
    restate: { score: 2, note: 'Good start.' }, answer: { score: 1, note: 'General.' },
    cite: { score: 1, note: 'One example.' }, explain: { score: 1, note: 'Say why.' },
    extend: { score: 0, note: 'No deeper idea.' },
  },
  categories: { knowledge: 'K text', thinking: 'T text', communication: 'C text', application: 'A text' },
  sentenceTags: [
    { sentence: 'The Acadians were deported.', tag: 'answer' },
    { sentence: 'Governor Lawrence ordered it in 1755.', tag: 'cite' },
  ],
  strengths: ['Clear start.'], nextSteps: ['Add a second date.'], pushQuestion: 'What would a Mi\'kmaw family say?',
  sentenceUpgrade: { original: 'It was bad.', better: 'It tore families apart.' }, conventions: [],
}
const TRANSCRIPT = 'The Acadians were deported. Governor Lawrence ordered it in 1755. It was bad.'
const REPORT = {
  session: { id: 's1', subject: 'history', status: 'draft_reviewed', item: ITEM, decode: { command_words_correct: true, parts_correct: true, focus_correct: false } },
  submissions: { draft: { id: 'd1', original: TRANSCRIPT, confirmed: TRANSCRIPT, diff: [], word_count: 14, review: REVIEW } },
}

function renderApp(profile = { id: 'p1', displayName: 'Sam', grade: '7' }) {
  const navigateTo = vi.fn()
  render(
    <SessionContext.Provider value={{ state: { profile }, navigateTo }}>
      <WritingCoach />
    </SessionContext.Provider>
  )
  return { navigateTo, user: userEvent.setup() }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  wc.reminder.mockResolvedValue(REMINDER)
})

describe('colour helpers', () => {
  it('cuts the answer into coloured and plain segments', () => {
    const segs = colourSegments(TRANSCRIPT, REVIEW.sentenceTags)
    expect(segs.map((s) => s.tag)).toEqual(['answer', null, 'cite', null])
    expect(segs.map((s) => s.text).join('')).toBe(TRANSCRIPT)
  })

  it('lists the steps that have no sentence', () => {
    expect(missingSteps(REVIEW.sentenceTags).map((s) => s.key)).toEqual(['restate', 'explain', 'extend'])
  })
})

describe('Start (success criteria)', () => {
  it('keeps the question locked until every item is ticked', async () => {
    const onBegin = vi.fn()
    const user = userEvent.setup()
    render(<Start reminder={REMINDER} onBegin={onBegin} onHistory={() => {}} />)
    const show = screen.getByRole('button', { name: 'Show my question' })
    expect(show).toBeDisabled()

    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(CRITERIA.length)
    for (const box of boxes.slice(0, -1)) await user.click(box)
    expect(show).toBeDisabled()
    await user.click(boxes.at(-1))
    expect(show).toBeEnabled()

    await user.click(show)
    expect(onBegin).toHaveBeenCalledWith('history', '')
  })

  it('shows the focus week, his last goal and the teacher rubric when set', () => {
    render(<Start reminder={{ ...REMINDER, rubric_override: 'Use two quotes.' }} onBegin={() => {}} onHistory={() => {}} />)
    expect(screen.getByText(/Week 2 focus: Cite and Explain/)).toBeInTheDocument()
    expect(screen.getByText(/Use two dates/)).toBeInTheDocument()
    expect(screen.getByText('Use two quotes.')).toBeInTheDocument()
  })

  it('needs the typed question for a school question', async () => {
    const user = userEvent.setup()
    render(<Start reminder={{ ...REMINDER, suggested_subject: 'school' }} onBegin={() => {}} onHistory={() => {}} />)
    for (const box of screen.getAllByRole('checkbox')) await user.click(box)
    expect(screen.getByRole('button', { name: 'Show my question' })).toBeDisabled()
    await user.type(screen.getByLabelText(/question from school/i), 'Why?')
    expect(screen.getByRole('button', { name: 'Show my question' })).toBeEnabled()
  })
})

describe('Report', () => {
  it('shows level, step scores, what he missed, colours and how to improve', () => {
    render(<Report report={REPORT} kind="draft" />)
    expect(screen.getByText(/Level 3-/)).toBeInTheDocument()
    expect(screen.getByText('72%')).toBeInTheDocument()
    // weakest step is flagged
    const extend = screen.getByText('Extend', { selector: 'span' }).closest('li')
    expect(within(extend).getByText('Work on this first')).toBeInTheDocument()
    expect(screen.getByText('Why it mattered today')).toBeInTheDocument()
    expect(screen.getByText(/No sentence matched these steps/)).toHaveTextContent('Restate, Explain, Extend')
    const answer = screen.getByTestId('coloured-answer')
    expect(answer.querySelector('mark[data-step="answer"]')).toHaveTextContent('The Acadians were deported.')
    expect(screen.getByText('Add a second date.')).toBeInTheDocument()
    expect(screen.getByText('It tore families apart.')).toBeInTheDocument()
    expect(screen.getByText(/in the 150 to 250|add more detail/)).toBeInTheDocument()
    expect(screen.getByText(/you missed the thinking focus/)).toBeInTheDocument()
  })

  it('compares the rewrite with the draft', () => {
    const rewrite = { ...REPORT.submissions.draft, id: 'r1', review: { ...REVIEW, level: '3+', percent: 78, missedParts: [] } }
    render(<Report report={{ ...REPORT, submissions: { ...REPORT.submissions, rewrite } }} kind="rewrite" />)
    expect(screen.getByText(/went up 6 percent/)).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('Rewrite')).toBeInTheDocument()
  })
})

describe('stepFromReport', () => {
  const sub = (extra) => ({ id: 'x', original: 'o', confirmed: null, review: null, ...extra })
  it('resumes at the right step', () => {
    const base = { session: { status: 'started' } }
    expect(stepFromReport({ ...base, submissions: {} }).step).toBe('question')
    expect(stepFromReport({ ...base, submissions: { draft: sub() } }).step).toBe('confirm')
    expect(stepFromReport({ ...base, submissions: { draft: sub({ confirmed: 'c' }) } }).step).toBe('review')
    expect(stepFromReport({ ...base, submissions: { draft: sub({ confirmed: 'c', review: {} }) } })).toEqual({ step: 'report', kind: 'draft' })
    expect(stepFromReport({ ...base, submissions: { draft: sub({ review: {} }), rewrite: sub() } }).kind).toBe('rewrite')
    expect(stepFromReport({ session: { status: 'done' }, submissions: {} })).toBeNull()
  })
})

describe('WritingCoach', () => {
  it('only opens for grade 7', () => {
    const { navigateTo } = renderApp({ id: 'p1', displayName: 'Sam', grade: '6' })
    expect(screen.getByText(/Writing Coach is for grade 7/)).toBeInTheDocument()
    expect(wc.reminder).not.toHaveBeenCalled()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('goes from the reminder to the question and the decode check', async () => {
    wc.createSession.mockResolvedValue({ id: 's1', subject: 'history', item: ITEM, decode: null })
    wc.decode.mockResolvedValue({
      command_words_correct: true, parts_correct: true, focus_correct: false,
      answer: { command_words: ['Explain'], parts: 1, thinking_focus: 'Cause and Consequence' },
    })
    const { user } = renderApp()
    await screen.findByText(/Before you start/)
    for (const box of screen.getAllByRole('checkbox')) await user.click(box)
    await user.click(screen.getByRole('button', { name: 'Show my question' }))

    expect(wc.createSession).toHaveBeenCalledWith('p1', { subject: 'history', school_question: null })
    await screen.findByText(ITEM.question)

    await user.click(screen.getByRole('button', { name: 'Explain' }))
    await user.selectOptions(screen.getByLabelText(/thinking focus/i), 'Historical Significance')
    await user.click(screen.getByRole('button', { name: 'Check my decoding' }))
    expect(wc.decode).toHaveBeenCalledWith('p1', 's1', {
      command_words: ['Explain'], parts: 1, thinking_focus: 'Historical Significance',
    })
    await screen.findByText(/Thinking focus: not quite. It was Cause and Consequence/)
    await user.click(screen.getByRole('button', { name: 'Start writing' }))
    expect(await screen.findByRole('timer')).toHaveTextContent('15:00')
    expect(screen.getByText(/at the top of your page/)).toBeInTheDocument()
  })

  it('shows a friendly message when the question cannot be made', async () => {
    wc.createSession.mockRejectedValue(new Error('The AI helper is busy right now. Please try again in a moment.'))
    const { user } = renderApp()
    await screen.findByText(/Before you start/)
    for (const box of screen.getAllByRole('checkbox')) await user.click(box)
    await user.click(screen.getByRole('button', { name: 'Show my question' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('busy right now')
    expect(screen.getByRole('button', { name: 'Show my question' })).toBeEnabled()
  })

  it('resumes an unfinished session after a refresh', async () => {
    window.localStorage.setItem('mathBuddy.wc.activeSession', 's1')
    wc.report.mockResolvedValue({ session: { ...REPORT.session, decode: null }, submissions: {} })
    renderApp()
    await screen.findByText(ITEM.question)
    expect(wc.report).toHaveBeenCalledWith('p1', 's1')
  })
})

describe('WritingCoachPanel (parent view)', () => {
  it('shows only date, subject, question and the levels, plus settings', async () => {
    wcParent.sessions.mockResolvedValue([
      { id: 's1', created_at: '2026-11-02T15:00:00Z', subject: 'history', question: 'Why did X?', draft: { level: '3-', percent: 72 }, rewrite: null },
    ])
    wcParent.getSettings.mockResolvedValue({ history_strand: 'A', focus_week: 1, rubric_override: null })
    wcParent.putSettings.mockResolvedValue({ history_strand: 'B', focus_week: 1, rubric_override: null })
    const user = userEvent.setup()
    render(<WritingCoachPanel token="tok" profileId="p1" />)

    expect(await screen.findByText('Why did X?')).toBeInTheDocument()
    expect(screen.getByText('3- (72%)')).toBeInTheDocument()
    expect(screen.queryByText(/feedback|transcript/i)).not.toBeInTheDocument()

    await user.selectOptions(await screen.findByLabelText(/History strand/), 'B')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    await waitFor(() => expect(wcParent.putSettings).toHaveBeenCalledWith('tok', 'p1', expect.objectContaining({ history_strand: 'B' })))
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })
})
