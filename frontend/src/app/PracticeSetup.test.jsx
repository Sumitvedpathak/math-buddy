import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PracticePage from './PracticePage'
import { SessionContext } from '../context/SessionContext'

vi.mock('react-sketch-canvas', () => ({
  ReactSketchCanvas: vi.fn(() => <div data-testid="sketch-canvas" />),
}))

const CURRICULUM = [
  {
    id: 'unit-02', number: 2, title: 'Ratio and Rate',
    lessons: [
      { id: '2.1', title: 'What Is a Ratio?', focus: 'Investigate ratios.', keywords: [] },
      { id: '2.2', title: 'Equivalent Ratios', focus: 'Write equivalent ratios.', keywords: [] },
      { id: '2.3', title: 'Comparing Ratios', focus: 'Compare ratios.', keywords: [] },
    ],
  },
  {
    id: 'unit-10', number: 10, title: 'Patterning and Algebra',
    lessons: [{ id: '10.1', title: 'Number Patterns', focus: 'Extend patterns.', keywords: [] }],
  },
]

const GRADE7 = { id: 'p1', email: 'k@e.co', displayName: 'Sam', grade: '7' }
const GRADE6 = { ...GRADE7, grade: '6' }

function renderSetup(stateOverrides = {}, actionOverrides = {}) {
  const ctx = {
    state: {
      questions: [],
      answers: {},
      error: null,
      ageGroup: '11-12',
      selectedTopics: [],
      questionCount: 30,
      profile: GRADE7,
      curriculum: CURRICULUM,
      lessonStatus: {},
      ...stateOverrides,
    },
    setAgeGroup: vi.fn(),
    toggleTopic: vi.fn(),
    setQuestionCount: vi.fn(),
    startSession: vi.fn(),
    startLesson: vi.fn(),
    setAnswer: vi.fn(),
    submitAnswers: vi.fn(),
    ...actionOverrides,
  }
  render(
    <SessionContext.Provider value={ctx}>
      <PracticePage />
    </SessionContext.Provider>
  )
  return { ctx, user: userEvent.setup() }
}

const TOPIC_NAMES = ['Vedic Maths', 'Word Problems', 'Algebra', 'Volumes']

describe('setup stage — grade gating', () => {
  it('grade 6 sees the four free-practice topics and no curriculum units', () => {
    renderSetup({ profile: GRADE6, curriculum: [], ageGroup: '9-10' })

    for (const name of TOPIC_NAMES) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
    expect(screen.queryByText(/curriculum/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /unit 2/i })).not.toBeInTheDocument()
  })

  it('grade 7 sees the same four topics plus the curriculum unit cards', () => {
    renderSetup()

    for (const name of TOPIC_NAMES) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('heading', { name: 'Grade 7 curriculum' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unit 2.*ratio and rate/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unit 10.*patterning and algebra/i })).toBeInTheDocument()
  })

  it('hides the manual age-group selector once a profile is loaded', () => {
    renderSetup()
    expect(screen.queryByRole('heading', { name: /age group/i })).not.toBeInTheDocument()
  })

  it('still shows the age-group selector when there is no profile', () => {
    renderSetup({ profile: null, curriculum: [] })
    expect(screen.getByRole('heading', { name: /age group/i })).toBeInTheDocument()
  })
})

describe('setup stage — lesson picker', () => {
  it('shows completion badges from lesson status', async () => {
    const { user } = renderSetup({
      lessonStatus: {
        '2.1': { completed: true, bestScorePct: 96 },
        '2.2': { completed: false, bestScorePct: 80.5 },
      },
    })

    await user.click(screen.getByRole('button', { name: /unit 2.*ratio and rate/i }))
    const lessons = screen.getByRole('region', { name: /unit 2 lessons/i })

    const row = (title) => within(lessons).getByText(title).closest('li')
    expect(within(row('What Is a Ratio?')).getByText(/mastered/i)).toBeInTheDocument()
    expect(within(row('Equivalent Ratios')).getByText('Best 80%')).toBeInTheDocument()
    expect(within(row('Equivalent Ratios')).queryByText(/mastered/i)).not.toBeInTheDocument()
    expect(within(row('Comparing Ratios')).getByText('Not started')).toBeInTheDocument()
  })

  it('summarises mastered lessons per unit on the unit card', () => {
    renderSetup({ lessonStatus: { '2.1': { completed: true, bestScorePct: 100 } } })
    expect(screen.getByRole('button', { name: /unit 2/i })).toHaveTextContent('1 of 3 lessons mastered')
  })

  it('starts the chosen lesson with a fixed 25-question set (no count control)', async () => {
    const { ctx, user } = renderSetup()

    await user.click(screen.getByRole('button', { name: /unit 2.*ratio and rate/i }))
    const lessons = screen.getByRole('region', { name: /unit 2 lessons/i })
    expect(within(lessons).getByText(/set of 25 questions/i)).toBeInTheDocument()
    expect(within(lessons).queryByRole('spinbutton')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /practice lesson 2\.2/i }))
    expect(ctx.startLesson).toHaveBeenCalledWith('2.2')
    expect(ctx.startSession).not.toHaveBeenCalled()
  })

  it('opens one unit at a time', async () => {
    const { user } = renderSetup()
    await user.click(screen.getByRole('button', { name: /unit 2.*ratio and rate/i }))
    await user.click(screen.getByRole('button', { name: /unit 10/i }))

    expect(screen.queryByRole('region', { name: /unit 2 lessons/i })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: /unit 10 lessons/i })).toBeInTheDocument()
  })
})
