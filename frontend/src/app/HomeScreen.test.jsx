import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomeScreen from './HomeScreen'
import { SessionContext } from '../context/SessionContext'

const mockCtx = {
  state: { screen: 'home' },
  navigateTo: vi.fn(),
}

function renderHome(ctx = mockCtx) {
  return render(
    <SessionContext.Provider value={ctx}>
      <HomeScreen />
    </SessionContext.Provider>
  )
}

describe('HomeScreen', () => {
  it('renders the hero headline', () => {
    renderHome()
    expect(screen.getByText(/maths that hits/i)).toBeInTheDocument()
  })

  it('renders the "Start a practice set" hero CTA button', () => {
    renderHome()
    expect(screen.getByRole('button', { name: /start a practice set/i })).toBeInTheDocument()
  })

  it('renders the four topic track cards', () => {
    renderHome()
    // Track cards use h3 headings — use exact heading text to avoid matching hero body copy
    expect(screen.getByRole('heading', { name: 'Vedic Maths' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Word Problems' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Algebra' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Volumes & Shapes' })).toBeInTheDocument()
  })

  it('renders the three How It Works numbered steps', () => {
    renderHome()
    // Step titles are unique headings in the How It Works section
    expect(screen.getByRole('heading', { name: /configure your set/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /solve your way/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /review, then refine/i })).toBeInTheDocument()
  })

  it('renders the CTA banner "Begin practising" button', () => {
    renderHome()
    expect(screen.getByRole('button', { name: /begin practising/i })).toBeInTheDocument()
  })
})
