import { describe, it, expect, vi } from 'vitest'
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuestionCard from './QuestionCard'

vi.mock('react-sketch-canvas', () => ({
  ReactSketchCanvas: React.forwardRef(function MockSketchCanvas(props, ref) {
    React.useImperativeHandle(ref, () => ({
      clearCanvas: vi.fn().mockResolvedValue(undefined),
      eraseMode: vi.fn(),
      exportImage: vi.fn().mockResolvedValue(''),
    }))
    return <div data-testid="sketch-canvas" aria-label={props['aria-label']} />
  }),
}))

const QUESTION = {
  id: 'q1',
  topic: 'Vedic Maths',
  problem_type: 'multiplication',
  text: '13 × 17',
  difficulty_tier: 1,
}

describe('QuestionCard', () => {
  it('renders the question text', () => {
    render(<QuestionCard question={QUESTION} answer={null} onAnswer={vi.fn()} questionNumber={1} />)
    expect(screen.getByText('13 × 17')).toBeInTheDocument()
  })

  it('shows the question number', () => {
    render(<QuestionCard question={QUESTION} answer={null} onAnswer={vi.fn()} questionNumber={3} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('defaults to text mode, with no sketch canvas shown', () => {
    render(<QuestionCard question={QUESTION} answer={null} onAnswer={vi.fn()} questionNumber={1} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.queryByTestId('sketch-canvas')).not.toBeInTheDocument()
  })

  it('switches to the sketch canvas on request', async () => {
    const user = userEvent.setup()
    render(<QuestionCard question={QUESTION} answer={null} onAnswer={vi.fn()} questionNumber={1} />)
    await user.click(screen.getByRole('button', { name: /sketch/i }))
    expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('reports typed answers in text mode', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    render(<QuestionCard question={QUESTION} answer={null} onAnswer={onAnswer} questionNumber={1} />)
    await user.type(screen.getByRole('textbox'), '2')
    expect(onAnswer).toHaveBeenCalledWith('q1', 'text', '2')
  })
})
