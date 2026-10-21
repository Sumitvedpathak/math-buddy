import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileScreen from './ProfileScreen'
import { SessionContext } from '../context/SessionContext'

const PROFILE = { id: 'p1', email: 'kid@example.com', displayName: 'Sam', grade: '7' }

let ctx
beforeEach(() => {
  ctx = {
    state: { screen: 'profile' },
    findProfile: vi.fn(),
    registerProfile: vi.fn(),
    enterProfile: vi.fn(),
  }
})

function setup() {
  render(
    <SessionContext.Provider value={ctx}>
      <ProfileScreen />
    </SessionContext.Provider>
  )
  return userEvent.setup()
}

describe('ProfileScreen', () => {
  it('signs in an existing profile without creating anything', async () => {
    ctx.findProfile.mockResolvedValue(PROFILE)
    const user = setup()

    await user.type(screen.getByLabelText('Email'), 'kid@example.com')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => expect(ctx.enterProfile).toHaveBeenCalledWith(PROFILE))
    expect(ctx.registerProfile).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('asks before creating when the email is unknown, and does not auto-create', async () => {
    ctx.findProfile.mockResolvedValue(null)
    const user = setup()

    await user.type(screen.getByLabelText('Email'), 'typo@example.com')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(/no profile found/i)
    expect(dialog).toHaveTextContent('typo@example.com')
    expect(ctx.registerProfile).not.toHaveBeenCalled()

    // "Check email again" backs out without creating a profile.
    await user.click(screen.getByRole('button', { name: /check email again/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(ctx.registerProfile).not.toHaveBeenCalled()
    expect(ctx.enterProfile).not.toHaveBeenCalled()
  })

  it('creates the profile only after explicit confirmation, then enters it', async () => {
    ctx.findProfile.mockResolvedValue(null)
    ctx.registerProfile.mockResolvedValue(PROFILE)
    const user = setup()

    await user.type(screen.getByLabelText('Email'), ' kid@example.com ')
    await user.type(screen.getByLabelText('Name'), 'Sam')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.click(await screen.findByRole('button', { name: /create new profile/i }))

    await waitFor(() => expect(ctx.enterProfile).toHaveBeenCalledWith(PROFILE))
    expect(ctx.registerProfile).toHaveBeenCalledWith({
      email: 'kid@example.com', displayName: 'Sam', grade: '7',
    })
  })

  it('will not create a profile without a name', async () => {
    ctx.findProfile.mockResolvedValue(null)
    const user = setup()

    await user.type(screen.getByLabelText('Email'), 'kid@example.com')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByRole('button', { name: /create new profile/i })).toBeDisabled()
  })

  it('rejects an invalid email before calling the API', async () => {
    const user = setup()
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i)
    expect(ctx.findProfile).not.toHaveBeenCalled()
  })

  it('shows a friendly error when the lookup fails', async () => {
    ctx.findProfile.mockRejectedValue(new Error('offline'))
    const user = setup()
    await user.type(screen.getByLabelText('Email'), 'kid@example.com')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/check your connection/i)
    expect(ctx.enterProfile).not.toHaveBeenCalled()
  })
})
