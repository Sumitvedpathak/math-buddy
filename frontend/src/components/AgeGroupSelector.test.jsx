import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AgeGroupSelector from '../components/AgeGroupSelector'

describe('AgeGroupSelector', () => {
  it('renders both age group options', () => {
    render(<AgeGroupSelector value="9-10" onChange={() => {}} />)
    expect(screen.getByText(/Age 9/i)).toBeInTheDocument()
    expect(screen.getByText(/Age 11/i)).toBeInTheDocument()
  })

  it('marks the current value as selected', () => {
    render(<AgeGroupSelector value="9-10" onChange={() => {}} />)
    const btn910 = screen.getByText(/Age 9/i).closest('button')
    expect(btn910).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onChange with the other value when toggled', () => {
    const onChange = vi.fn()
    render(<AgeGroupSelector value="9-10" onChange={onChange} />)
    fireEvent.click(screen.getByText(/Age 11/i))
    expect(onChange).toHaveBeenCalledWith('11-12')
  })

  it('emits the selected value on click', () => {
    const onChange = vi.fn()
    render(<AgeGroupSelector value="11-12" onChange={onChange} />)
    fireEvent.click(screen.getByText(/Age 9/i))
    expect(onChange).toHaveBeenCalledWith('9-10')
  })
})
