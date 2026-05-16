import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Leaderboard from './Leaderboard'
import { SessionContext } from '../context/SessionContext'

function renderLeaderboard() {
  return render(
    <SessionContext.Provider value={{ state: { screen: 'leaderboard' }, navigateTo: vi.fn() }}>
      <Leaderboard />
    </SessionContext.Provider>
  )
}

describe('Leaderboard', () => {
  it('renders the page heading', () => {
    renderLeaderboard()
    expect(screen.getByText(/most consistent/i)).toBeInTheDocument()
  })

  it('renders the top-ranked learner name in the podium', () => {
    renderLeaderboard()
    expect(screen.getAllByText('Aarav S.').length).toBeGreaterThan(0)
  })

  it('renders the full ranked table column headers', () => {
    renderLeaderboard()
    expect(screen.getByText('Rank')).toBeInTheDocument()
    expect(screen.getByText('Learner')).toBeInTheDocument()
    // "Sets", "Accuracy", "Streak" appear in both podium cards and table header
    expect(screen.getAllByText('Sets').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Accuracy').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Streak').length).toBeGreaterThan(0)
  })
})
