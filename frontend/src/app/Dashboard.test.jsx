import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dashboard from '../app/Dashboard'
import { SessionContext } from '../context/SessionContext'

const EVALUATION_RESULT = {
  results: [
    { questionId: 'q1', marks: 2, feedback: 'Great work!' },
    { questionId: 'q2', marks: 1, feedback: 'Nearly there.' },
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
  it('shows the total score', () => {
    renderDashboard()
    expect(screen.getByText(/3\s*\/\s*4/)).toBeInTheDocument()
  })

  it('shows per-topic score cards', () => {
    renderDashboard()
    expect(screen.getByText('Algebra')).toBeInTheDocument()
    expect(screen.getByText('Vedic Maths')).toBeInTheDocument()
  })

  it('shows per-question feedback', () => {
    renderDashboard()
    expect(screen.getByText('Great work!')).toBeInTheDocument()
  })

  it('calls resetSession when Try Again is clicked', async () => {
    const user = userEvent.setup()
    const resetSpy = vi.fn()
    const ctx = {
      state: {
        evaluationResult: EVALUATION_RESULT,
        questions: [],
      },
      resetSession: resetSpy,
    }
    render(
      <SessionContext.Provider value={ctx}>
        <Dashboard />
      </SessionContext.Provider>
    )
    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(resetSpy).toHaveBeenCalledOnce()
  })
})
