import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ParentApp, { isParentPath } from './ParentApp'
import { ConsentRequiredError, refreshSession, signInWithGoogle, signOut } from '../../lib/auth'

vi.mock('../../lib/auth', async () => {
  const actual = await vi.importActual('../../lib/auth')
  return {
    ConsentRequiredError: actual.ConsentRequiredError,
    refreshSession: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }
})

// Google's real button needs Google's script; this stand-in hands back a fake ID token.
vi.mock('./GoogleButton', () => ({
  default: ({ onCredential }) => (
    <button type="button" onClick={() => onCredential('fake-id-token')}>
      Continue with Google
    </button>
  ),
}))

const ME = { kind: 'parent', parent: { id: 'p1', email: 'ana@example.com', display_name: 'Ana Parent' } }

beforeEach(() => {
  vi.clearAllMocks()
  refreshSession.mockResolvedValue(null)
  signOut.mockResolvedValue(undefined)
})

describe('isParentPath', () => {
  it('matches /parent only', () => {
    expect(isParentPath('/parent')).toBe(true)
    expect(isParentPath('/parent/')).toBe(true)
    expect(isParentPath('/')).toBe(false)
    expect(isParentPath('/parents')).toBe(false)
    expect(isParentPath('/admin/abc')).toBe(false)
  })
})

describe('ParentApp', () => {
  it('shows the Google button when nobody is signed in', async () => {
    render(<ParentApp />)
    expect(await screen.findByRole('button', { name: /continue with google/i })).toBeInTheDocument()
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it('goes straight to the parent area when the browser is still signed in', async () => {
    refreshSession.mockResolvedValue(ME)
    render(<ParentApp />)
    expect(await screen.findByText('Ana Parent')).toBeInTheDocument()
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument()
  })

  it('signs a returning parent in with Google', async () => {
    signInWithGoogle.mockResolvedValue(ME)
    render(<ParentApp />)

    await userEvent.click(await screen.findByRole('button', { name: /continue with google/i }))

    expect(signInWithGoogle).toHaveBeenCalledWith('fake-id-token', { acceptedTerms: false })
    expect(await screen.findByText('Ana Parent')).toBeInTheDocument()
  })

  it('asks a new parent to agree before creating the account', async () => {
    signInWithGoogle
      .mockRejectedValueOnce(new ConsentRequiredError())
      .mockResolvedValueOnce(ME)
    render(<ParentApp />)
    await userEvent.click(await screen.findByRole('button', { name: /continue with google/i }))

    const create = await screen.findByRole('button', { name: /create my account/i })
    expect(create).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: /parent or legal guardian/i }))
    await userEvent.click(create)

    expect(signInWithGoogle).toHaveBeenLastCalledWith('fake-id-token', { acceptedTerms: true })
    expect(await screen.findByText('Ana Parent')).toBeInTheDocument()
  })

  it('shows a plain message when sign-in fails', async () => {
    signInWithGoogle.mockRejectedValue(Object.assign(new Error('Sign-in failed'), { status: 401 }))
    render(<ParentApp />)
    await userEvent.click(await screen.findByRole('button', { name: /continue with google/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not sign you in/i)
  })

  it('signs out back to the sign-in page', async () => {
    refreshSession.mockResolvedValue(ME)
    render(<ParentApp />)
    await userEvent.click(await screen.findByRole('button', { name: /sign out/i }))

    expect(signOut).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('button', { name: /continue with google/i })).toBeInTheDocument()
  })
})
