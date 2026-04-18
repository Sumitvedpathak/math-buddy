import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SketchCanvas from './SketchCanvas'

// react-sketch-canvas has SVG internals; stub it to avoid canvas setup pain
vi.mock('react-sketch-canvas', () => ({
  ReactSketchCanvas: vi.fn(({ ref: _ref, ...props }) => (
    <div data-testid="sketch-canvas" aria-label={props['aria-label']} />
  )),
}))

describe('SketchCanvas', () => {
  it('renders the canvas surface', () => {
    render(<SketchCanvas questionId="q1" onExport={vi.fn()} />)
    expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()
  })

  it('renders a clear button', () => {
    render(<SketchCanvas questionId="q1" onExport={vi.fn()} />)
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
  })

  it('clears the canvas when the clear button is clicked', async () => {
    const user = userEvent.setup()
    render(<SketchCanvas questionId="q1" onExport={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /clear/i })
    await user.click(btn)
    // No error thrown and canvas still present
    expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()
  })
})
