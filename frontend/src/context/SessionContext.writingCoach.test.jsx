import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionProvider, useSession } from './SessionContext'

vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal()),
  lookupProfile: vi.fn().mockResolvedValue({ id: 'p1', email: 'k@e.co', displayName: 'Sam', grade: '7' }),
  fetchCurriculum: vi.fn().mockResolvedValue([]),
  fetchLessonStatus: vi.fn().mockResolvedValue({}),
}))

const FLAG = 'mathBuddy.wc.open'

function Probe() {
  const { state, navigateTo } = useSession()
  return (
    <div>
      <p data-testid="screen">{state.screen}</p>
      <p data-testid="status">{state.profileStatus}</p>
      <button type="button" onClick={() => navigateTo('writingCoach')}>open</button>
      <button type="button" onClick={() => navigateTo('home')}>home</button>
    </div>
  )
}

function renderProvider() {
  render(<SessionProvider><Probe /></SessionProvider>)
  return waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.localStorage.setItem('mathBuddy.profile', JSON.stringify({ profileId: 'p1', email: 'k@e.co' }))
})

describe('refreshing while on Writing Coach', () => {
  it('stays on Writing Coach after a refresh', async () => {
    window.sessionStorage.setItem(FLAG, '1')
    await renderProvider()
    expect(screen.getByTestId('screen')).toHaveTextContent('writingCoach')
  })

  it('opens on home otherwise', async () => {
    await renderProvider()
    expect(screen.getByTestId('screen')).toHaveTextContent('home')
  })

  it('remembers entering and leaving Writing Coach', async () => {
    const user = userEvent.setup()
    await renderProvider()
    await user.click(screen.getByRole('button', { name: 'open' }))
    expect(window.sessionStorage.getItem(FLAG)).toBe('1')
    await user.click(screen.getByRole('button', { name: 'home' }))
    expect(window.sessionStorage.getItem(FLAG)).toBeNull()
  })
})
