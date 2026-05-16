import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import About from './About'
import { SessionContext } from '../context/SessionContext'

function renderAbout() {
  return render(
    <SessionContext.Provider value={{ state: { screen: 'about' }, navigateTo: vi.fn() }}>
      <About />
    </SessionContext.Provider>
  )
}

describe('About', () => {
  it('renders the about page heading', () => {
    renderAbout()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('renders the "Working over answers." principle', () => {
    renderAbout()
    expect(screen.getByText(/working over answers/i)).toBeInTheDocument()
  })

  it('renders the roadmap entry for Maths ages 9–12', () => {
    renderAbout()
    expect(screen.getByText(/maths · ages 9/i)).toBeInTheDocument()
  })

  it('renders the "Start practising" CTA button', () => {
    renderAbout()
    expect(screen.getByRole('button', { name: /start practising/i })).toBeInTheDocument()
  })
})
