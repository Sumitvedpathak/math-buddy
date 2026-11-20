import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ParentApp, { isParentPath } from './ParentApp'
import { ConsentRequiredError, refreshSession, signInWithGoogle, signOut } from '../../lib/auth'
import { addChild, createLinkCode, updateChild } from '../../lib/api'

vi.mock('../../lib/auth', async () => {
  const actual = await vi.importActual('../../lib/auth')
  return {
    ConsentRequiredError: actual.ConsentRequiredError,
    refreshSession: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }
})

vi.mock('../../lib/api', () => ({ addChild: vi.fn(), updateChild: vi.fn(), createLinkCode: vi.fn() }))

// Google's real button needs Google's script; this stand-in hands back a fake ID token.
vi.mock('./GoogleButton', () => ({
  default: ({ onCredential }) => (
    <button type="button" onClick={() => onCredential('fake-id-token')}>
      Continue with Google
    </button>
  ),
}))

const ME = {
  kind: 'parent',
  parent: { id: 'p1', email: 'ana@example.com', display_name: 'Ana Parent' },
  children: [],
}
const AARAV = { id: 'c1', display_name: 'Aarav', grade: '7' }

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


describe('ParentApp children', () => {
  it('says so when there are no children yet', async () => {
    refreshSession.mockResolvedValue(ME)
    render(<ParentApp />)
    expect(await screen.findByText(/no children yet/i)).toBeInTheDocument()
  })

  it('lists the children with their grade', async () => {
    refreshSession.mockResolvedValue({ ...ME, children: [AARAV] })
    render(<ParentApp />)
    const list = await screen.findByRole('list', { name: /your children/i })
    expect(within(list).getByText('Aarav')).toBeInTheDocument()
    expect(within(list).getByText(/grade 7/i)).toBeInTheDocument()
  })

  it('adds a child', async () => {
    refreshSession.mockResolvedValue(ME)
    addChild.mockResolvedValue({ id: 'c2', display_name: 'Mira', grade: '6' })
    render(<ParentApp />)

    await userEvent.type(await screen.findByLabelText(/child's name/i), 'Mira')
    await userEvent.click(screen.getByRole('radio', { name: /grade 6/i }))
    await userEvent.click(screen.getByRole('button', { name: /add child/i }))

    expect(addChild).toHaveBeenCalledWith({ displayName: 'Mira', grade: '6' })
    const list = await screen.findByRole('list', { name: /your children/i })
    expect(within(list).getByText('Mira')).toBeInTheDocument()
    expect(screen.getByLabelText(/child's name/i)).toHaveValue('')
  })

  it('does not add a child without a name', async () => {
    refreshSession.mockResolvedValue(ME)
    render(<ParentApp />)
    expect(await screen.findByRole('button', { name: /add child/i })).toBeDisabled()
  })

  it('edits a child', async () => {
    refreshSession.mockResolvedValue({ ...ME, children: [AARAV] })
    updateChild.mockResolvedValue({ ...AARAV, display_name: 'Aaru', grade: '6' })
    render(<ParentApp />)

    await userEvent.click(await screen.findByRole('button', { name: /edit aarav/i }))
    const name = screen.getByLabelText(/name for aarav/i)
    await userEvent.clear(name)
    await userEvent.type(name, 'Aaru')
    await userEvent.selectOptions(screen.getByLabelText(/grade for aarav/i), '6')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(updateChild).toHaveBeenCalledWith('c1', { displayName: 'Aaru', grade: '6' })
    const list = await screen.findByRole('list', { name: /your children/i })
    expect(within(list).getByText('Aaru')).toBeInTheDocument()
    expect(within(list).getByText(/grade 6/i)).toBeInTheDocument()
  })

  it('shows a message when adding fails', async () => {
    refreshSession.mockResolvedValue(ME)
    addChild.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }))
    render(<ParentApp />)

    await userEvent.type(await screen.findByLabelText(/child's name/i), 'Mira')
    await userEvent.click(screen.getByRole('button', { name: /add child/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i)
  })
})


describe('ParentApp link a device', () => {
  it('shows a one-time code for the child with the time left', async () => {
    refreshSession.mockResolvedValue({ ...ME, children: [AARAV] })
    const inTenMinutes = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    createLinkCode.mockResolvedValue({ code: '7K4Q-9PXM', expiresAt: inTenMinutes })
    render(<ParentApp />)

    await userEvent.click(await screen.findByRole('button', { name: /link a device for aarav/i }))

    expect(createLinkCode).toHaveBeenCalledWith('c1')
    const panel = await screen.findByRole('region', { name: /link code for aarav/i })
    expect(within(panel).getByText('7K4Q-9PXM')).toBeInTheDocument()
    expect(within(panel).getByText(/(10|9):\d\d/)).toBeInTheDocument()
    await userEvent.click(within(panel).getByRole('button', { name: /done/i }))
    expect(screen.queryByText('7K4Q-9PXM')).not.toBeInTheDocument()
  })

  it('says so when the code could not be made', async () => {
    refreshSession.mockResolvedValue({ ...ME, children: [AARAV] })
    createLinkCode.mockRejectedValue(Object.assign(new Error('Too many'), { status: 429 }))
    render(<ParentApp />)

    await userEvent.click(await screen.findByRole('button', { name: /link a device for aarav/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many codes/i)
  })
})
