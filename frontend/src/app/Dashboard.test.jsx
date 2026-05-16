import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dashboard from '../app/Dashboard'
import { SessionContext } from '../context/SessionContext'

const EVALUATION_RESULT = {
  results: [
    { questionId: 'q1', marks: 2, feedback: 'Great work!' },
    {
      questionId: 'q2',
      marks: 1,
      feedback: 'Nearly there.',
      studentAnswer: '221',
      correctAnswer: '221 (with Vedic working shown)',
    },
  ],
  totalScore: 3,
  maxScore: 4,
  topicBreakdown: {
    Algebra: { score: 2, maxScore: 2, questionCount: 1 },
    'Vedic Maths': { score: 1, maxScore: 2, questionCount: 1 },
  },
}

function renderDashboard(overrides = {}) {
  const contextValue = {
    state: {
      evaluationResult: EVALUATION_RESULT,
      questions: [
        { id: 'q1', topic: 'Algebra', text: '144÷12', difficulty_tier: 1 },
        { id: 'q2', topic: 'Vedic Maths', text: '13×17', difficulty_tier: 2 },
      ],
      answers: {},
      ...overrides,
    },
    resetSession: vi.fn(),
  }
  return render(
    <SessionContext.Provider value={contextValue}>
      <Dashboard />
    </SessionContext.Provider>
  )
}

describe('Dashboard', () => {
  it('shows the total score in the score hero', () => {
    renderDashboard()
    // Score fraction: "3" (large display) and "/ 4" in the hero panel
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(/\/\s*4/)).toBeInTheDocument()
  })

  it('shows the by-topic section header', () => {
    renderDashboard()
    expect(screen.getByText(/by topic/i)).toBeInTheDocument()
  })

  it('shows per-topic entries', () => {
    renderDashboard()
    expect(screen.getByText('Algebra')).toBeInTheDocument()
    expect(screen.getByText('Vedic Maths')).toBeInTheDocument()
  })

  it('shows per-question feedback in the review list', () => {
    renderDashboard()
    expect(screen.getByText('Great work!')).toBeInTheDocument()
  })

  it('shows student vs correct answer when not full marks', () => {
    renderDashboard()
    expect(screen.getByText(/your answer/i)).toBeInTheDocument()
    expect(screen.getByText(/correct answer/i)).toBeInTheDocument()
    expect(screen.getByText(/221 \(with vedic working shown\)/i)).toBeInTheDocument()
  })

  it('falls back to typed submission when API omits studentAnswer', () => {
    const evalPartial = {
      ...EVALUATION_RESULT,
      results: [
        EVALUATION_RESULT.results[0],
        { questionId: 'q2', marks: 0, feedback: 'Not quite.', correctAnswer: '96 cookies' },
      ],
    }
    renderDashboard({
      evaluationResult: evalPartial,
      answers: { q2: { questionId: 'q2', mode: 'text', content: '90 cookies' } },
    })
    expect(screen.getByText(/90 cookies/)).toBeInTheDocument()
    expect(screen.getByText(/96 cookies/)).toBeInTheDocument()
  })

  it('renders the "Start a new set" button', () => {
    renderDashboard()
    expect(screen.getByRole('button', { name: /start a new set/i })).toBeInTheDocument()
  })

  it('calls resetSession when "Start a new set" is clicked', async () => {
    const user = userEvent.setup()
    const resetSpy = vi.fn()
    render(
      <SessionContext.Provider value={{
        state: { evaluationResult: EVALUATION_RESULT, questions: [], answers: {} },
        resetSession: resetSpy,
      }}>
        <Dashboard />
      </SessionContext.Provider>
    )
    await user.click(screen.getByRole('button', { name: /start a new set/i }))
    expect(resetSpy).toHaveBeenCalledOnce()
  })
})
