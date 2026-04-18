import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import HomeScreen from './HomeScreen'
import { SessionProvider } from '../context/SessionContext'

// Wrap in provider so useSession works
function renderWithProvider(ui) {
  return render(<SessionProvider>{ui}</SessionProvider>)
}

describe('HomeScreen', () => {
  it('has Start Practice button disabled when no topic is selected', () => {
    renderWithProvider(<HomeScreen />)
    const btn = screen.getByRole('button', { name: /start practice/i })
    expect(btn).toBeDisabled()
  })

  it('enables Start Practice when at least one topic is selected', () => {
    renderWithProvider(<HomeScreen />)
    // Click the first topic button
    const topicButtons = screen.getAllByRole('button').filter(
      (b) => !b.textContent.match(/start practice/i) && !b.textContent.match(/age/i)
    )
    fireEvent.click(topicButtons[0])
    const btn = screen.getByRole('button', { name: /start practice/i })
    expect(btn).not.toBeDisabled()
  })
})
