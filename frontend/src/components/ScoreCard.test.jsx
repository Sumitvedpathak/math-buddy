import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ScoreCard from './ScoreCard'

describe('ScoreCard', () => {
  it('renders the topic name', () => {
    render(<ScoreCard topic="Algebra" score={4} maxScore={6} questionCount={3} />)
    expect(screen.getByText('Algebra')).toBeInTheDocument()
  })

  it('displays score / maxScore', () => {
    render(<ScoreCard topic="Algebra" score={4} maxScore={6} questionCount={3} />)
    expect(screen.getByText(/4\s*\/\s*6/)).toBeInTheDocument()
  })

  it('shows question count', () => {
    render(<ScoreCard topic="Algebra" score={4} maxScore={6} questionCount={3} />)
    expect(screen.getByText(/3\s*questions?/i)).toBeInTheDocument()
  })
})
