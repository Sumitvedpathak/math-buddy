import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dashboard from './Dashboard'
import { SessionContext } from '../context/SessionContext'

const CURRICULUM = [
  { id: 'unit-10', number: 10, title: 'Patterning and Algebra',
    lessons: [{ id: '10.3', title: 'Variables in Expressions', focus: '', keywords: [], theory_pages: 2 }] },
]

function renderDashboard({ totalScore, maxScore, ...stateOverrides }) {
  const ctx = {
    state: {
      evaluationResult: {
        results: [{ questionId: 'q1', marks: 2, feedback: 'Good' }],
        totalScore,
        maxScore,
        topicBreakdown: { 'Variables in Expressions': { score: totalScore, maxScore, questionCount: 1 } },
      },
      questions: [{ id: 'q1', topic: 'Variables in Expressions', text: '3n + 1', difficulty_tier: 1 }],
      answers: {},
      curriculum: CURRICULUM,
      lessonId: '10.3',
      saveStatus: 'saved',
      ...stateOverrides,
    },
    resetSession: vi.fn(),
    startLesson: vi.fn(),
    openLesson: vi.fn(),
  }
  render(
    <SessionContext.Provider value={ctx}>
      <Dashboard />
    </SessionContext.Provider>
  )
  return { ctx, user: userEvent.setup() }
}

describe('Dashboard — curriculum lesson outcome', () => {
  it('shows "Lesson mastered" at 95% and offers no retry', () => {
    renderDashboard({ totalScore: 95, maxScore: 100 })
    expect(screen.getByRole('heading', { name: /lesson mastered/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /try again with new questions/i })).not.toBeInTheDocument()
    expect(screen.getByText(/lesson 10\.3/i)).toHaveTextContent('Variables in Expressions')
  })

  it('shows "Lesson mastered" for 24/25 (96%)', () => {
    renderDashboard({ totalScore: 48, maxScore: 50 })
    expect(screen.getByRole('heading', { name: /lesson mastered/i })).toBeInTheDocument()
  })

  it('does not round 94.6% up to mastery', () => {
    renderDashboard({ totalScore: 473, maxScore: 500 })
    expect(screen.queryByRole('heading', { name: /lesson mastered/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /keep practising/i })).toBeInTheDocument()
  })

  it('below 95% offers an immediate retry with fresh questions for the same lesson', async () => {
    const { ctx, user } = renderDashboard({ totalScore: 40, maxScore: 50 })

    await user.click(screen.getByRole('button', { name: /try again with new questions/i }))
    expect(ctx.startLesson).toHaveBeenCalledWith('10.3')
  })

  it('offers to re-read the lesson when not yet mastered', async () => {
    const { ctx, user } = renderDashboard({ totalScore: 40, maxScore: 50 })
    await user.click(screen.getByRole('button', { name: /read the lesson again/i }))
    expect(ctx.openLesson).toHaveBeenCalledWith('10.3')
  })

  it('does not offer re-reading once the lesson is mastered', () => {
    renderDashboard({ totalScore: 50, maxScore: 50 })
    expect(screen.queryByRole('button', { name: /read the lesson again/i })).not.toBeInTheDocument()
  })

  it('"Back to lessons" resets the session', async () => {
    const { ctx, user } = renderDashboard({ totalScore: 50, maxScore: 50 })
    await user.click(screen.getByRole('button', { name: /back to lessons/i }))
    expect(ctx.resetSession).toHaveBeenCalled()
  })

  it('shows no lesson panel for free practice', () => {
    renderDashboard({ totalScore: 50, maxScore: 50, lessonId: null })
    expect(screen.queryByLabelText(/lesson result/i)).not.toBeInTheDocument()
  })

  it('shows a non-blocking banner when saving failed, and keeps the results', () => {
    renderDashboard({ totalScore: 40, maxScore: 50, saveStatus: 'failed' })
    expect(screen.getByRole('status')).toHaveTextContent(/may not have saved/i)
    expect(screen.getByText(/question review/i)).toBeInTheDocument()
  })

  it('shows no banner when saving worked', () => {
    renderDashboard({ totalScore: 40, maxScore: 50, saveStatus: 'saved' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
