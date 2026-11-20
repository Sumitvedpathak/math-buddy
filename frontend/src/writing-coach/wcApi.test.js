import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { wc, wcParent } from './wcApi'
import { linkDevice, resetAuthForTests } from '../lib/auth'

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

beforeEach(async () => {
  resetAuthForTests()
  vi.stubGlobal('fetch', vi.fn())
  fetch.mockResolvedValueOnce(jsonResponse({
    access_token: 'child-token', expires_in: 900,
    me: { kind: 'child', profile: { id: 'c1', display_name: 'Sam', grade: '7' } },
  }))
  await linkDevice('7K4Q-9PXM')
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('wc (the child)', () => {
  it('sends the sign-in, not a profile id', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ id: 's1' }, 201))

    await wc.createSession('c1', { subject: 'history' })

    const [url, init] = fetch.mock.calls[1]
    expect(url).toBe('/api/v1/wc/sessions')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer child-token')
    expect(init.headers['X-Profile-Id']).toBeUndefined()
    expect(JSON.parse(init.body)).toEqual({ subject: 'history' })
  })

  it("shows the server's message, or the first validation message", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ detail: 'Writing Coach is for grade 7.' }, 403))
    await expect(wc.reminder('c1')).rejects.toMatchObject({ message: 'Writing Coach is for grade 7.', status: 403 })

    fetch.mockResolvedValueOnce(jsonResponse({ detail: [{ msg: 'Too short' }] }, 422))
    await expect(wc.reminder('c1')).rejects.toMatchObject({ message: 'Too short', status: 422 })

    fetch.mockResolvedValueOnce(jsonResponse({}, 500))
    await expect(wc.reminder('c1')).rejects.toMatchObject({
      message: 'Something went wrong (500). Please try again.',
    })
  })
})

describe('wcParent (admin page)', () => {
  it('still uses the admin token', async () => {
    fetch.mockResolvedValueOnce(jsonResponse([]))
    await wcParent.sessions('tok', 'c1')
    const [url, init] = fetch.mock.calls[1]
    expect(url).toBe('/api/v1/wc/parent/sessions?profile_id=c1')
    expect(init.headers['X-Admin-Token']).toBe('tok')
  })
})
