import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PracticePage from '../app/PracticePage'
import { SessionContext } from '../context/SessionContext'

vi.mock('react-sketch-canvas', () => ({
  ReactSketchCanvas: vi.fn(() => <div data-testid="sketch-canvas" />),
}))

const QUESTIONS = [
  { id: 'q1', topic: 'Algebra', problem_type: 'division', text: '144 ÷ 12', difficulty_tier: 1 },
  { id: 'q2', topic: 'Algebra', problem_type: 'fractions', text: '3/6', difficulty_tier: 2 },
]

const DEFAULT_CTX = {
  state: { questions: QUESTIONS, answers: {}, error: null },
  setAnswer: vi.fn(),
  submitAnswers: vi.fn(),
}

function renderWithSession(contextValue = DEFAULT_CTX) {
  return render(
    <SessionContext.Provider value={contextValue}>
      <PracticePage />
    </SessionContext.Provider>
  )
}

describe('PracticePage', () => {
  it('renders all questions', () => {
    renderWithSession()
    expect(screen.getByText('144 ÷ 12')).toBeInTheDocument()
    // FractionText renders "3/6" as a stacked fraction (separate spans for numerator and denominator)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('shows a submit button', () => {
    renderWithSession()
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })

  it('asks for confirmation when submitting with no answers', async () => {
    const user = userEvent.setup()
    renderWithSession()
    await user.click(screen.getByRole('button', { name: /submit/i }))
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
  })
})
