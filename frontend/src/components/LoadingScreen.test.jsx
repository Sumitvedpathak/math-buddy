import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import LoadingScreen from './LoadingScreen'

describe('LoadingScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('displays the first fun fact on mount', () => {
    render(<LoadingScreen funFacts={['Fact A', 'Fact B', 'Fact C']} message="Loading…" />)
    expect(screen.getByText('Fact A')).toBeInTheDocument()
  })

  it('advances to the next fact after the rotation interval', () => {
    render(<LoadingScreen funFacts={['Fact A', 'Fact B', 'Fact C']} message="Loading…" />)
    act(() => { vi.advanceTimersByTime(4000) })
    expect(screen.getByText('Fact B')).toBeInTheDocument()
  })

  it('never shows the same fact twice within one cycle', () => {
    const facts = ['A', 'B', 'C', 'D']
    render(<LoadingScreen funFacts={facts} message="Loading…" />)
    const seen = new Set()
    seen.add(screen.getByText('A').textContent)
    for (let i = 0; i < facts.length - 1; i++) {
      act(() => { vi.advanceTimersByTime(4000) })
      const visible = facts.find((f) => {
        try { return !!screen.getByText(f) } catch { return false }
      })
      expect(seen.has(visible)).toBe(false)
      seen.add(visible)
    }
  })

  it('shows the progress bar', () => {
    render(<LoadingScreen funFacts={[]} message="Generating…" />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})
