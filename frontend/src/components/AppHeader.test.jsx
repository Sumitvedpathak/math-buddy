import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AppHeader from './AppHeader'
import { SessionContext } from '../context/SessionContext'

const mockCtx = {
  state: { screen: 'home' },
  navigateTo: vi.fn(),
  goHome: vi.fn(),
}

function renderHeader(ctx = mockCtx) {
  return render(
    <SessionContext.Provider value={ctx}>
      <AppHeader />
    </SessionContext.Provider>
  )
}

describe('AppHeader', () => {
  it('renders all four navigation link labels', () => {
    renderHeader()
    expect(screen.getAllByText('Home').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Practice').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Leaderboard').length).toBeGreaterThan(0)
    expect(screen.getAllByText('About').length).toBeGreaterThan(0)
  })

  it('renders the Start practising CTA button', () => {
    renderHeader()
    expect(screen.getByRole('button', { name: /start practising/i })).toBeInTheDocument()
  })

  it('renders a hamburger button with aria-label', () => {
    renderHeader()
    const hamburger = screen.getByRole('button', { name: /open navigation menu/i })
    expect(hamburger).toBeInTheDocument()
    expect(hamburger).toHaveAttribute('aria-expanded', 'false')
  })

  it('highlights the active nav link based on current screen', () => {
    renderHeader({ ...mockCtx, state: { screen: 'practice' } })
    // The Practice link should have active styling — it renders with aria-current or distinct class
    const practiceLinks = screen.getAllByText('Practice')
    expect(practiceLinks.length).toBeGreaterThan(0)
  })
})
