import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionContext } from '../context/SessionContext'
import WritingCoach, { stepFromReport } from './WritingCoach'
import Report from './Report'
import Start, { CRITERIA } from './Start'
import History from './History'
import EditPass, { COPS } from './EditPass'
import WritingCoachPanel from './WritingCoachPanel'
import { colourSegments, missingSteps } from './colours'
import { wc, wcParent } from './wcApi'

vi.mock('./wcApi', () => ({
  wc: {
    reminder: vi.fn(), createSession: vi.fn(), decode: vi.fn(), report: vi.fn(),
    listSessions: vi.fn(), overview: vi.fn(),
  },
  wcParent: { sessions: vi.fn(), progress: vi.fn(), getSettings: vi.fn(), putSettings: vi.fn() },
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
  last_next_time: 'Use two dates', suggested_subject: 'history',
  is_rest_day: false, history_strand: 'A',
}
const OLD_REVIEW = {
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
  sentenceUpgrade: { original: 'It was bad.', better: 'It tore families apart.' },
  conventions: {
    score: 1, levelAdjustment: -1,
    errors: [
      { original: 'grand river', correction: 'Grand River', type: 'capitalization', category: 'capital_place', rule: 'Names of places need capitals' },
      { original: 'haudenosaunee', correction: 'Haudenosaunee', type: 'capitalization', category: 'capital_group', rule: 'Names of nations need capitals' },
    ],
  },
  contentLevel: '3', contentPercent: 75,
}
const REVIEW = {
  level: '2+', percent: 69, summary: 'You answered clearly.', allPartsAnswered: false,
  missedParts: ['Why it mattered today'], hasSpecificEvidence: true,
  overall: { level: '2+', percent: 69, capApplied: false },
  criteria: {
    understanding: { level: '3', percent: 74, note: 'You answered clearly.', nextStep: 'Add one thoughtful idea.' },
    evidence: { level: '2+', percent: 68, note: 'One date.', nextStep: 'Explain how your date proves your point.' },
    communication: {
      level: '2', percent: 65, note: 'Some errors.', nextStep: 'Write 5 to 7 full sentences.',
      sentenceCount: 2, repeatedOpeners: ['This tract'],
      errors: [{ original: 'grand river', correction: 'Grand River', type: 'capitalization', category: 'capital_place', rule: 'Names of places need capitals' }],
    },
  },
  sentenceTags: [
    { sentence: 'The Acadians were deported.', tag: 'answer' },
    { sentence: 'Governor Lawrence ordered it in 1755.', tag: 'cite' },
  ],
  strengths: ['Clear start.'], nextSteps: ['Add a second date.'], pushQuestion: 'What would a Mi\'kmaw family say?',
  sentenceUpgrade: { original: 'It was bad.', better: 'It tore families apart.' },
}
const TRANSCRIPT = 'The Acadians were deported. Governor Lawrence ordered it in 1755. It was bad.'
const REPORT = {
  session: { id: 's1', subject: 'history', status: 'draft_reviewed', item: ITEM, decode: { command_words_correct: true, parts_correct: true, focus_correct: false } },
  submissions: { draft: { id: 'd1', original: TRANSCRIPT, confirmed: TRANSCRIPT, diff: [], word_count: 14, review: REVIEW } },
}

const withReview = (review) => ({ ...REPORT, submissions: { draft: { ...REPORT.submissions.draft, review } } })
const OLD_REPORT = withReview(OLD_REVIEW)

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

  it('shows the focus week and his last goal', () => {
    render(<Start reminder={REMINDER} onBegin={() => {}} onHistory={() => {}} />)
    expect(screen.getByText(/Week 2 focus: Cite and Explain/)).toBeInTheDocument()
    expect(screen.getByText(/Use two dates/)).toBeInTheDocument()
  })

  it('shows the teacher\'s Level 4 column in kid-friendly words', () => {
    render(<Start reminder={REMINDER} onBegin={() => {}} onHistory={() => {}} />)
    const card = screen.getByRole('region', { name: 'What Level 4 looks like' })
    expect(card).toHaveTextContent('Understand: answer the whole question + one insight')
    expect(card).toHaveTextContent('Evidence: specific proof + explain how it supports you')
    expect(card).toHaveTextContent('Communicate: 5–7 complete sentences, varied openings, check capitals/spelling/punctuation')
  })

  it('asks for 5 to 7 sentences, not a word count', () => {
    expect(CRITERIA.join(' ')).toMatch(/5 to 7 complete sentences/)
    expect(CRITERIA.join(' ')).not.toMatch(/150/)
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
  it('shows the overall mark and the three criteria, each with its next step', () => {
    render(<Report report={REPORT} kind="draft" />)
    expect(screen.getByText(/Level 2\+/)).toBeInTheDocument()
    expect(screen.getByText('69%')).toBeInTheDocument()
    const marks = screen.getByRole('region', { name: 'Your three marks' })
    const cards = within(marks).getAllByRole('listitem')
    expect(cards.map((c) => within(c).getByRole('heading').textContent)).toEqual(['Understanding', 'Evidence', 'Communication'])
    expect(cards[0]).toHaveTextContent('74%')
    expect(cards[0]).toHaveTextContent('Add one thoughtful idea.')
    expect(cards[1]).toHaveTextContent('Explain how your date proves your point.')
    expect(cards[2]).toHaveTextContent('Write 5 to 7 full sentences.')
  })

  it('flags the lowest criterion to work on first', () => {
    render(<Report report={REPORT} kind="draft" />)
    const flag = screen.getByText('Work on this first')
    expect(flag.closest('li')).toHaveTextContent('Communication')
    expect(screen.getAllByText('Work on this first')).toHaveLength(1)
  })

  it('explains the cap only when it was applied', () => {
    const { unmount } = render(<Report report={REPORT} kind="draft" />)
    expect(screen.queryByText(/no quote or specific fact/)).not.toBeInTheDocument()
    unmount()
    render(<Report report={withReview({ ...REVIEW, overall: { ...REVIEW.overall, capApplied: true } })} kind="draft" />)
    expect(screen.getByText(/no quote or specific fact/)).toBeInTheDocument()
  })

  it('reports the sentence count against the target and repeated openers', () => {
    render(<Report report={REPORT} kind="draft" />)
    const box = screen.getByRole('region', { name: 'Your sentences' })
    expect(box).toHaveTextContent('2 sentences')
    expect(box).toHaveTextContent('The target is 5 to 7, so add more')
    expect(box).toHaveTextContent('This tract')
  })

  it('says when the sentence count is on target or too long', () => {
    const count = (n) => withReview({
      ...REVIEW,
      criteria: { ...REVIEW.criteria, communication: { ...REVIEW.criteria.communication, sentenceCount: n, repeatedOpeners: [] } },
    })
    const { unmount } = render(<Report report={count(6)} kind="draft" />)
    expect(screen.getByRole('region', { name: 'Your sentences' })).toHaveTextContent('in the 5 to 7 target')
    unmount()
    render(<Report report={count(9)} kind="draft" />)
    expect(screen.getByRole('region', { name: 'Your sentences' })).toHaveTextContent('so tighten it')
  })

  it('lists the mistakes to fix before handing it in', () => {
    render(<Report report={REPORT} kind="draft" />)
    const section = screen.getByRole('region', { name: 'Fix these before you hand it in' })
    expect(within(section).getByText('Grand River')).toBeInTheDocument()
    expect(within(section).getByText('Names of places need capitals')).toBeInTheDocument()
  })

  it('keeps the colours as coaching, what he missed and how to improve', () => {
    render(<Report report={REPORT} kind="draft" />)
    expect(screen.getByText(/do not change your mark/)).toBeInTheDocument()
    expect(screen.getByText('Why it mattered today')).toBeInTheDocument()
    const answer = screen.getByTestId('coloured-answer')
    expect(answer.querySelector('mark[data-step="answer"]')).toHaveTextContent('The Acadians were deported.')
    expect(screen.getByText('Add a second date.')).toBeInTheDocument()
    expect(screen.getByText('It tore families apart.')).toBeInTheDocument()
    expect(screen.getByText(/you missed the thinking focus/)).toBeInTheDocument()
  })

  it('drops the old step scores, four areas, conventions score and word target', () => {
    render(<Report report={REPORT} kind="draft" />)
    expect(screen.queryByText('Your score for each step')).not.toBeInTheDocument()
    expect(screen.queryByText('The four areas')).not.toBeInTheDocument()
    expect(screen.queryByText(/Conventions score/)).not.toBeInTheDocument()
    expect(screen.queryByText(/150 to 250/)).not.toBeInTheDocument()
  })

  it('compares the rewrite with the draft', () => {
    const rewrite = { ...REPORT.submissions.draft, id: 'r1', review: { ...REVIEW, level: '3+', percent: 78, missedParts: [] } }
    render(<Report report={{ ...REPORT, submissions: { ...REPORT.submissions, rewrite } }} kind="rewrite" />)
    expect(screen.getByText(/went up 9 percent/)).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('Rewrite')).toBeInTheDocument()
  })

  it('shows whether the draft mistakes were fixed in the rewrite', () => {
    const fixed = [
      { original: 'grand river', correction: 'Grand River', status: 'fixed' },
      { original: 'haudenosaunee', correction: 'Haudenosaunee', status: 'still_there' },
    ]
    const rewrite = { ...REPORT.submissions.draft, id: 'r1', fixed_errors: fixed, review: REVIEW }
    render(<Report report={{ ...REPORT, submissions: { ...REPORT.submissions, rewrite } }} kind="rewrite" />)
    const section = screen.getByRole('region', { name: 'Fixed errors' })
    expect(within(section).getByText('You fixed 1 of 2.')).toBeInTheDocument()
    expect(within(section).getByText('Fixed')).toBeInTheDocument()
    expect(within(section).getByText('Still there')).toBeInTheDocument()
  })
})

describe('Report for an older review', () => {
  it('keeps the old layout: step scores, four areas and conventions', () => {
    render(<Report report={OLD_REPORT} kind="draft" />)
    expect(screen.getByText(/Level 3-/)).toBeInTheDocument()
    const extend = screen.getByText('Extend', { selector: 'span' }).closest('li')
    expect(within(extend).getByText('Work on this first')).toBeInTheDocument()
    expect(screen.getByText('The four areas')).toBeInTheDocument()
    const section = screen.getByRole('region', { name: 'Conventions' })
    expect(within(section).getByText(/Conventions score:/)).toHaveTextContent('1/2')
    expect(within(section).getByText(/Your ideas earned Level 3, so your level is 3-/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Your three marks' })).not.toBeInTheDocument()
  })

  it('copes with the oldest reviews that have no conventions block', () => {
    render(<Report report={withReview({ ...OLD_REVIEW, conventions: [] })} kind="draft" />)
    expect(screen.queryByRole('region', { name: 'Conventions' })).not.toBeInTheDocument()
  })
})

describe('My results', () => {
  const OVERVIEW = {
    session_count: 2, recent_count: 2, sessions_with_missed_parts: 0, command_words_missed: [],
    top_errors: [], timeline: [], average_sentence_count: 4,
    criteria: [{ key: 'communication', average: 65 }, { key: 'evidence', average: 68 }, { key: 'understanding', average: 74 }],
  }

  it('ranks the three criteria, weakest first, and uses the sentence target', async () => {
    wc.listSessions.mockResolvedValue([])
    wc.overview.mockResolvedValue(OVERVIEW)
    render(<History profileId="p1" onBack={() => {}} onNew={() => {}} />)
    const region = await screen.findByRole('region', { name: 'Where you are lagging' })
    expect(within(region).getByText(/Weakest first/)).toHaveTextContent('Communication needs the most work')
    expect(within(region).getByText('65%')).toBeInTheDocument()
    expect(within(region).getByText(/average 4 sentences. The target is 5 to 7/)).toBeInTheDocument()
  })

  it('hides the ranking when only older reviews exist', async () => {
    wc.listSessions.mockResolvedValue([])
    wc.overview.mockResolvedValue({ ...OVERVIEW, criteria: [] })
    render(<History profileId="p1" onBack={() => {}} onNew={() => {}} />)
    const region = await screen.findByRole('region', { name: 'Where you are lagging' })
    expect(within(region).queryByText(/Weakest first/)).not.toBeInTheDocument()
  })
})

describe('stepFromReport', () => {
  const sub = (extra) => ({ id: 'x', original: 'o', confirmed: null, review: null, ...extra })
  it('resumes at the right step', () => {
    const base = { session: { status: 'started' } }
    expect(stepFromReport({ ...base, submissions: {} }).step).toBe('question')
    expect(stepFromReport({ ...base, submissions: { draft: sub() } }).step).toBe('confirm')
    expect(stepFromReport({ ...base, submissions: { draft: sub({ confirmed: 'c' }) } }).step).toBe('confirm')
    expect(stepFromReport({ session: { status: 'started', decode: { parts_correct: true } }, submissions: {} }).step).toBe('write')
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
    expect(await screen.findByRole('heading', { name: 'Write your answer' })).toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(screen.getByText(/at the top of your page/)).toBeInTheDocument()
    // the success criteria stay on screen while he writes, in an expandable section
    const criteria = screen.getByText('My success criteria').closest('details')
    expect(criteria).toHaveAttribute('open')
    expect(within(criteria).getAllByRole('checkbox')).toHaveLength(CRITERIA.length)
    expect(screen.getByText(/Restate: I will turn the question into my first sentence/)).toBeInTheDocument()
  })

  it('has a Back button on each step to return to the previous one', async () => {
    wc.createSession.mockResolvedValue({ id: 's1', subject: 'history', item: ITEM, decode: null })
    const { navigateTo, user } = renderApp()
    await screen.findByText(/Before you start/)
    await user.click(screen.getByRole('button', { name: /Back to Math Buddy/ }))
    expect(navigateTo).toHaveBeenCalledWith('practice')

    for (const box of screen.getAllByRole('checkbox')) await user.click(box)
    await user.click(screen.getByRole('button', { name: 'Show my question' }))
    await screen.findByText(ITEM.question)

    await user.click(screen.getByRole('button', { name: /Back/ }))
    await screen.findByText(/Before you start/)

    // the criteria must be ticked again before every practice
    expect(screen.getByRole('button', { name: 'Show my question' })).toBeDisabled()
    for (const box of screen.getAllByRole('checkbox')) await user.click(box)
    await user.click(screen.getByRole('button', { name: 'Show my question' }))
    await screen.findByText(ITEM.question)
    wc.decode.mockResolvedValue({
      command_words_correct: true, parts_correct: true, focus_correct: true,
      answer: { command_words: ['Explain'], parts: 1, thinking_focus: 'Cause and Consequence' },
    })
    await user.click(screen.getByRole('button', { name: 'Explain' }))
    await user.selectOptions(screen.getByLabelText(/thinking focus/i), 'Cause and Consequence')
    await user.click(screen.getByRole('button', { name: 'Check my decoding' }))
    await user.click(await screen.findByRole('button', { name: 'Start writing' }))
    await screen.findByRole('heading', { name: 'Write your answer' })
    await user.click(screen.getByRole('button', { name: /take a photo/i }))
    await screen.findByText(/Check your paper with COPS/)
    for (const box of screen.getAllByRole('checkbox')) await user.click(box)
    await user.click(screen.getByRole('button', { name: /take a photo/i }))
    await screen.findByText(/Photograph your answer/)
    await user.click(screen.getByRole('button', { name: /Back/ }))
    await screen.findByText(/Check your paper with COPS/)
    await user.click(screen.getByRole('button', { name: /Back/ }))
    await screen.findByRole('heading', { name: 'Write your answer' })
    await user.click(screen.getByRole('button', { name: /Back/ }))
    await screen.findByText(ITEM.question)
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

describe('Continue where you left off', () => {
  const UNFINISHED = [
    { id: 's9', subject: 'language', question: 'Justify how the conflict drives the plot.', created_at: '2026-11-02T15:00:00Z', stage: 'draft_check' },
  ]

  it('lists unfinished practice on the start page and reopens it', async () => {
    const onContinue = vi.fn()
    const user = userEvent.setup()
    render(<Start reminder={{ ...REMINDER, unfinished: UNFINISHED }} onBegin={() => {}} onHistory={() => {}} onContinue={onContinue} />)
    const box = screen.getByRole('region', { name: 'Continue where you left off' })
    expect(within(box).getByText(UNFINISHED[0].question)).toBeInTheDocument()
    expect(within(box).getByText(/Check the text and mark it/)).toBeInTheDocument()
    await user.click(within(box).getByRole('button', { name: 'Continue' }))
    expect(onContinue).toHaveBeenCalledWith('s9')
  })

  it('needs no ticking to continue, and hides when nothing is unfinished', () => {
    render(<Start reminder={{ ...REMINDER, unfinished: [] }} onBegin={() => {}} onHistory={() => {}} onContinue={() => {}} />)
    expect(screen.queryByRole('region', { name: 'Continue where you left off' })).not.toBeInTheDocument()
  })

  it('opens the chosen practice at its saved text, without marking it automatically', async () => {
    wc.reminder.mockResolvedValue({ ...REMINDER, unfinished: UNFINISHED })
    wc.review = vi.fn()
    wc.report.mockResolvedValue({
      session: { ...REPORT.session, id: 's9', status: 'started' },
      submissions: { draft: { id: 'd9', original: 'My saved text', confirmed: 'My saved text', diff: [], word_count: 3, review: null } },
    })
    const { user } = renderApp()
    await screen.findByText(/Before you start/)
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('textbox', { name: 'What we read' })).toHaveValue('My saved text')
    expect(wc.review).not.toHaveBeenCalled()
    expect(window.localStorage.getItem('mathBuddy.wc.activeSession')).toBe('s9')
  })

  it('after a refresh keeps his place when marking would fail', async () => {
    window.localStorage.setItem('mathBuddy.wc.activeSession', 's1')
    wc.review = vi.fn().mockRejectedValue(new Error('The AI helper ran into a problem.'))
    wc.report.mockResolvedValue({
      session: { ...REPORT.session, status: 'started' },
      submissions: { draft: { id: 'd1', original: 'Saved words', confirmed: 'Saved words', diff: [], word_count: 2, review: null } },
    })
    renderApp()
    expect(await screen.findByRole('textbox', { name: 'What we read' })).toHaveValue('Saved words')
    expect(window.localStorage.getItem('mathBuddy.wc.activeSession')).toBe('s1')
  })

  it('does not forget the session on a temporary load failure', async () => {
    window.localStorage.setItem('mathBuddy.wc.activeSession', 's1')
    wc.report.mockRejectedValue(Object.assign(new Error('Server error'), { status: 500 }))
    renderApp()
    await screen.findByText(/Before you start/)
    expect(window.localStorage.getItem('mathBuddy.wc.activeSession')).toBe('s1')
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('forgets a session the server no longer has', async () => {
    window.localStorage.setItem('mathBuddy.wc.activeSession', 'gone')
    wc.report.mockRejectedValue(Object.assign(new Error('Session not found'), { status: 404 }))
    renderApp()
    await screen.findByText(/Before you start/)
    expect(window.localStorage.getItem('mathBuddy.wc.activeSession')).toBeNull()
  })
})

describe('WritingCoachPanel (parent view)', () => {
  it('shows only date, subject, question and the levels, plus settings', async () => {
    wcParent.sessions.mockResolvedValue([
      { id: 's1', created_at: '2026-11-02T15:00:00Z', subject: 'history', question: 'Why did X?', draft: { level: '3-', percent: 72 }, rewrite: null,
        corrections: [{ kind: 'draft', changes: [{ op: 'replace', before: 'Haldiman', after: 'Haldimand', suspect: true }] }] },
    ])
    wcParent.progress.mockResolvedValue({
      trend: [{
        date: '2026-11-02T15:00:00Z', subject: 'history',
        understanding: { level: '3', percent: 74 }, evidence: { level: '2+', percent: 68 },
        communication: { level: '2', percent: 65 }, overall: { level: '2+', percent: 69 },
        cap_applied: true, errors_flagged: 3, errors_fixed: 2,
      }],
      averages: { understanding: 74, evidence: 68, communication: 65, overall: 69 },
      lowest: 'communication',
      top_errors: [{ category: 'capital_place', label: 'capitals on place names', count: 4 }],
    })
    wcParent.getSettings.mockResolvedValue({ history_strand: 'A', focus_week: 1 })
    wcParent.putSettings.mockResolvedValue({ history_strand: 'B', focus_week: 1 })
    const user = userEvent.setup()
    render(<WritingCoachPanel token="tok" profileId="p1" />)

    expect(await screen.findByText('Why did X?')).toBeInTheDocument()
    expect(screen.getByText('3- (72%)')).toBeInTheDocument()
    expect(screen.queryByText(/feedback/i)).not.toBeInTheDocument()
    // each criterion trended separately, the lowest one marked, and the cap shown
    const trend = await screen.findByRole('table', { name: 'Marks for each criterion' })
    const row = (name) => within(trend).getByRole('row', { name: new RegExp(`^${name}`) })
    expect(row('Understanding')).toHaveTextContent('3')
    expect(row('Evidence')).toHaveTextContent('2+')
    expect(row('Communication')).toHaveTextContent('65% lowest')
    expect(row('Overall')).toHaveTextContent('2+ capped')
    expect(row('Draft mistakes fixed')).toHaveTextContent('2 of 3')
    expect(screen.queryByLabelText(/rubric/i)).not.toBeInTheDocument()
    // most common mistakes, and what he changed while checking the text
    expect(screen.getByText('capitals on place names: 4')).toBeInTheDocument()
    expect(screen.getByText(/He changed 1 word while checking the text/)).toBeInTheDocument()
    expect(screen.getByText(/\u201cHaldiman\u201d \u2192 \u201cHaldimand\u201d/)).toBeInTheDocument()
    expect(screen.getByText(/looks like a spelling fix/)).toBeInTheDocument()

    await user.selectOptions(await screen.findByLabelText(/History strand/), 'B')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    await waitFor(() => expect(wcParent.putSettings).toHaveBeenCalledWith('tok', 'p1', expect.objectContaining({ history_strand: 'B' })))
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })
})

describe('Personal error tracker and edit pass', () => {
  it('shows his recurring errors on the reminder screen', () => {
    render(<Start reminder={{ ...REMINDER, top_errors_sessions: 5, top_errors: [{ category: 'capital_place', label: 'capitals on place names', count: 4 }] }} onBegin={() => {}} onHistory={() => {}} />)
    const box = screen.getByRole('region', { name: 'Your top errors' })
    expect(box).toHaveTextContent('In your last 5 practices you missed capitals on place names 4 times.')
  })

  it('requires COPS to be ticked before the photo', async () => {
    const onDone = vi.fn()
    const user = userEvent.setup()
    render(<EditPass topErrors={[{ category: 'capital_place', label: 'capitals on place names', count: 4 }]} onDone={onDone} />)
    const go = screen.getByRole('button', { name: /Take a photo/ })
    expect(go).toBeDisabled()
    expect(screen.getByText('capitals on place names')).toBeInTheDocument()
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(COPS.length)
    for (const b of boxes) await user.click(b)
    await user.click(go)
    expect(onDone).toHaveBeenCalled()
  })
})
