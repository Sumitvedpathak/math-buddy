import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StartScreen from './StartScreen'
import { SessionContext } from '../context/SessionContext'

let ctx
beforeEach(() => {
  ctx = {
    state: { screen: 'start', signedOut: false },
    linkWithCode: vi.fn(),
  }
})

function setup() {
  render(
    <SessionContext.Provider value={ctx}>
      <StartScreen />
    </SessionContext.Provider>
  )
  return userEvent.setup()
}

describe('StartScreen', () => {
  it("offers the two ways in: I'm a kid, I'm a parent", () => {
    setup()
    const kid = screen.getByRole('region', { name: /i'm a kid/i })
    expect(within(kid).getByLabelText(/code from your parent/i)).toBeInTheDocument()
    const parent = screen.getByRole('region', { name: /i'm a parent/i })
    expect(within(parent).getByRole('link', { name: /sign in with google/i })).toHaveAttribute('href', '/parent')
  })

  it('has no email sign-in', () => {
    setup()
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
  })

  it('says why when this device was signed out (unlinked by a parent)', () => {
    ctx.state.signedOut = true
    setup()
    expect(screen.getByRole('status')).toHaveTextContent(/signed out on this device/i)
  })

  it('says nothing about signing out on a normal visit', () => {
    setup()
    expect(screen.queryByText(/signed out on this device/i)).not.toBeInTheDocument()
  })
})

describe('StartScreen link code', () => {
  it('links this device with the code from a parent', async () => {
    ctx.linkWithCode.mockResolvedValue(undefined)
    const user = setup()

    await user.type(screen.getByLabelText(/code from your parent/i), '7k4q-9pxm')
    await user.click(screen.getByRole('button', { name: /use code/i }))

    expect(ctx.linkWithCode).toHaveBeenCalledWith('7k4q-9pxm')
  })

  it('explains a code that did not work', async () => {
    ctx.linkWithCode.mockRejectedValue(Object.assign(new Error('Code not valid'), { status: 401 }))
    const user = setup()

    await user.type(screen.getByLabelText(/code from your parent/i), 'ABCD-EFGH')
    await user.click(screen.getByRole('button', { name: /use code/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/ask your parent for a new one/i)
  })

  it('asks to wait after too many tries', async () => {
    ctx.linkWithCode.mockRejectedValue(Object.assign(new Error('Too many'), { status: 429 }))
    const user = setup()

    await user.type(screen.getByLabelText(/code from your parent/i), 'ABCD-EFGH')
    await user.click(screen.getByRole('button', { name: /use code/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/wait a few minutes/i)
  })
})
