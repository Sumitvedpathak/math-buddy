import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ParentApp, { isParentPath } from './ParentApp'
import { ConsentRequiredError, refreshSession, signInWithGoogle, signOut } from '../../lib/auth'
import {
  addChild,
  cancelLinkCode,
  createLinkCode,
  listChildren,
  listDevices,
  renameDevice,
  unlinkDevice,
  updateChild,
} from '../../lib/api'

vi.mock('../../lib/auth', async () => {
  const actual = await vi.importActual('../../lib/auth')
  return {
    ConsentRequiredError: actual.ConsentRequiredError,
    refreshSession: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }
})

vi.mock('../../lib/api', () => ({
  addChild: vi.fn(),
  updateChild: vi.fn(),
  createLinkCode: vi.fn(),
  cancelLinkCode: vi.fn(),
  listChildren: vi.fn(),
  listDevices: vi.fn(),
  renameDevice: vi.fn(),
  unlinkDevice: vi.fn(),
}))

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
const AARAV = { id: 'c1', display_name: 'Aarav', grade: '7', linked_devices: 0 }

beforeEach(() => {
  vi.clearAllMocks()
  refreshSession.mockResolvedValue(null)
  signOut.mockResolvedValue(undefined)
  cancelLinkCode.mockResolvedValue(null)
  listChildren.mockResolvedValue([])
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
  })

  it('copies the code so it can be sent to the child', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    refreshSession.mockResolvedValue({ ...ME, children: [AARAV] })
    const inTenMinutes = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    createLinkCode.mockResolvedValue({ code: '7K4Q-9PXM', expiresAt: inTenMinutes })
    render(<ParentApp />)

    await userEvent.click(await screen.findByRole('button', { name: /link a device for aarav/i }))
    const panel = await screen.findByRole('region', { name: /link code for aarav/i })
    await userEvent.click(within(panel).getByRole('button', { name: /copy code/i }))

    expect(writeText).toHaveBeenCalledWith('7K4Q-9PXM')
    expect(await within(panel).findByRole('button', { name: /copied/i })).toBeInTheDocument()
  })

  it('cancels the code so it stops working', async () => {
    refreshSession.mockResolvedValue({ ...ME, children: [AARAV] })
    const inTenMinutes = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    createLinkCode.mockResolvedValue({ code: '7K4Q-9PXM', expiresAt: inTenMinutes })
    render(<ParentApp />)

    await userEvent.click(await screen.findByRole('button', { name: /link a device for aarav/i }))
    const panel = await screen.findByRole('region', { name: /link code for aarav/i })
    await userEvent.click(within(panel).getByRole('button', { name: /cancel code/i }))

    expect(cancelLinkCode).toHaveBeenCalledWith('c1')
    expect(screen.queryByText('7K4Q-9PXM')).not.toBeInTheDocument()
  })

  it('closes the code and shows the device once the child has used it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      refreshSession.mockResolvedValue({ ...ME, children: [AARAV] })
      const inTenMinutes = new Date(Date.now() + 10 * 60 * 1000).toISOString()
      createLinkCode.mockResolvedValue({ code: '7K4Q-9PXM', expiresAt: inTenMinutes })
      listChildren.mockResolvedValue([{ ...AARAV, linked_devices: 1 }])
      render(<ParentApp />)

      await userEvent.click(await screen.findByRole('button', { name: /link a device for aarav/i }))
      await screen.findByText('7K4Q-9PXM')
      await act(async () => {
        vi.advanceTimersByTime(3500)
      })

      expect(await screen.findByText(/aarav's device is linked/i)).toBeInTheDocument()
      expect(screen.queryByText('7K4Q-9PXM')).not.toBeInTheDocument()
      expect(screen.getByText(/linked on 1 device/i)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('says so when the code could not be made', async () => {
    refreshSession.mockResolvedValue({ ...ME, children: [AARAV] })
    createLinkCode.mockRejectedValue(Object.assign(new Error('Too many'), { status: 429 }))
    render(<ParentApp />)

    await userEvent.click(await screen.findByRole('button', { name: /link a device for aarav/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many codes/i)
  })
})


describe('ParentApp linked devices', () => {
  const LINKED = { ...AARAV, linked_devices: 1 }
  const DEVICE = {
    id: 's1',
    name: 'Chrome on Windows',
    createdAt: '2026-11-18T10:00:00Z',
    lastUsedAt: '2026-11-20T09:00:00Z',
  }

  it('says whether each child is linked yet', async () => {
    refreshSession.mockResolvedValue({
      ...ME,
      children: [AARAV, { id: 'c2', display_name: 'Mira', grade: '6', linked_devices: 2 }],
    })
    render(<ParentApp />)
    expect(await screen.findByText(/not linked yet/i)).toBeInTheDocument()
    expect(screen.getByText(/linked on 2 devices/i)).toBeInTheDocument()
  })

  async function openDevices() {
    refreshSession.mockResolvedValue({ ...ME, children: [LINKED] })
    listDevices.mockResolvedValue([DEVICE])
    render(<ParentApp />)
    await userEvent.click(await screen.findByRole('button', { name: /devices for aarav/i }))
    return screen.findByRole('list', { name: /aarav's devices/i })
  }

  it('lists the devices signed in as the child', async () => {
    const list = await openDevices()
    expect(listDevices).toHaveBeenCalledWith('c1')
    expect(within(list).getByText('Chrome on Windows')).toBeInTheDocument()
    expect(within(list).getByText(/last used/i)).toBeInTheDocument()
  })

  it('renames a device', async () => {
    renameDevice.mockResolvedValue({ ...DEVICE, name: "Aarav's laptop" })
    const list = await openDevices()

    await userEvent.click(within(list).getByRole('button', { name: /rename chrome on windows/i }))
    const box = within(list).getByRole('textbox', { name: /new name for chrome on windows/i })
    await userEvent.clear(box)
    await userEvent.type(box, "Aarav's laptop")
    await userEvent.click(within(list).getByRole('button', { name: /save/i }))

    expect(renameDevice).toHaveBeenCalledWith('s1', "Aarav's laptop")
    expect(await within(list).findByText("Aarav's laptop")).toBeInTheDocument()
  })

  it('unlinks a device after asking first', async () => {
    unlinkDevice.mockResolvedValue(null)
    const list = await openDevices()

    await userEvent.click(within(list).getByRole('button', { name: /unlink chrome on windows/i }))
    expect(unlinkDevice).not.toHaveBeenCalled()
    await userEvent.click(within(list).getByRole('button', { name: /yes, unlink/i }))

    expect(unlinkDevice).toHaveBeenCalledWith('s1')
    expect(await screen.findByText(/not linked yet/i)).toBeInTheDocument()
    expect(screen.queryByText('Chrome on Windows')).not.toBeInTheDocument()
  })

  it('drops the "device is linked" note once that device is unlinked', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      refreshSession.mockResolvedValue({ ...ME, children: [AARAV] })
      const inTenMinutes = new Date(Date.now() + 10 * 60 * 1000).toISOString()
      createLinkCode.mockResolvedValue({ code: '7K4Q-9PXM', expiresAt: inTenMinutes })
      listChildren.mockResolvedValue([LINKED])
      listDevices.mockResolvedValue([DEVICE])
      unlinkDevice.mockResolvedValue(null)
      render(<ParentApp />)

      await userEvent.click(await screen.findByRole('button', { name: /link a device for aarav/i }))
      await screen.findByText('7K4Q-9PXM')
      await act(async () => {
        vi.advanceTimersByTime(3500)
      })
      expect(await screen.findByText(/aarav's device is linked/i)).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: /devices for aarav/i }))
      const list = await screen.findByRole('list', { name: /aarav's devices/i })
      await userEvent.click(within(list).getByRole('button', { name: /unlink chrome on windows/i }))
      await userEvent.click(within(list).getByRole('button', { name: /yes, unlink/i }))

      expect(await screen.findByText(/not linked yet/i)).toBeInTheDocument()
      expect(screen.queryByText(/aarav's device is linked/i)).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the device when the parent changes their mind', async () => {
    const list = await openDevices()
    await userEvent.click(within(list).getByRole('button', { name: /unlink chrome on windows/i }))
    await userEvent.click(within(list).getByRole('button', { name: /keep/i }))
    expect(unlinkDevice).not.toHaveBeenCalled()
    expect(within(list).getByText('Chrome on Windows')).toBeInTheDocument()
  })
})
