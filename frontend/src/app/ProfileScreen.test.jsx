import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileScreen from './ProfileScreen'
import { SessionContext } from '../context/SessionContext'

let ctx
beforeEach(() => {
  ctx = {
    state: { screen: 'profile' },
    linkWithCode: vi.fn(),
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
  it('has no email sign-in any more: only the code from a parent', () => {
    setup()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/code from your parent/i)).toBeInTheDocument()
  })

  it('points parents to their sign-in page', () => {
    setup()
    expect(screen.getByRole('link', { name: /sign in with google/i })).toHaveAttribute('href', '/parent')
  })
})

describe('ProfileScreen link code', () => {
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
