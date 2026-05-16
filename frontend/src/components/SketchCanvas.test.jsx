import { describe, it, expect, vi } from 'vitest'
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SketchCanvas from './SketchCanvas'

// react-sketch-canvas has SVG internals; stub it to avoid canvas setup pain
vi.mock('react-sketch-canvas', () => ({
  ReactSketchCanvas: React.forwardRef(function MockSketchCanvas(props, ref) {
    React.useImperativeHandle(ref, () => ({
      clearCanvas: vi.fn().mockResolvedValue(undefined),
      eraseMode: vi.fn(),
      exportImage: vi.fn().mockResolvedValue('data:image/png;base64,'),
    }))
    return (
      <div
        data-testid="sketch-canvas"
        data-canvas-id={props.id}
        aria-label={props['aria-label']}
      />
    )
  }),
}))

describe('SketchCanvas', () => {
  it('renders the canvas surface', () => {
    render(<SketchCanvas questionId="q1" onExport={vi.fn()} />)
    expect(screen.getByTestId('sketch-canvas')).toBeInTheDocument()
  })

  it('renders draw, eraser, and clear controls', () => {
    render(<SketchCanvas questionId="q1" onExport={vi.fn()} />)
    expect(screen.getByRole('button', { name: /draw with pen/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /erase part of sketch/i })).toBeInTheDocument()
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

  it('passes a unique svg id per question (fixes eraser with multiple canvases)', () => {
    const { rerender } = render(<SketchCanvas questionId="q-one" onExport={vi.fn()} />)
    expect(screen.getByTestId('sketch-canvas')).toHaveAttribute('data-canvas-id', 'sketch-q-one')
    rerender(<SketchCanvas questionId="q/two" onExport={vi.fn()} />)
    expect(screen.getByTestId('sketch-canvas')).toHaveAttribute('data-canvas-id', 'sketch-q-two')
  })

  it('selecting eraser marks the eraser toggle pressed', async () => {
    const user = userEvent.setup()
    render(<SketchCanvas questionId="q1" onExport={vi.fn()} />)
    const eraser = screen.getByRole('button', { name: /erase part of sketch/i })
    await user.click(eraser)
    expect(eraser).toHaveAttribute('aria-pressed', 'true')
    const draw = screen.getByRole('button', { name: /draw with pen/i })
    expect(draw).toHaveAttribute('aria-pressed', 'false')
  })
})
