import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ConsentRequiredError,
  TERMS_VERSION,
  authFetch,
  getAccessToken,
  refreshSession,
  resetAuthForTests,
  signInWithGoogle,
  signOut,
} from './auth'

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

const ME = { kind: 'parent', parent: { id: 'p1', email: 'ana@example.com', display_name: 'Ana' } }
const signedIn = (token) => jsonResponse({ access_token: token, expires_in: 900, me: ME })

beforeEach(() => {
  resetAuthForTests()
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('signInWithGoogle', () => {
  it('sends the Google ID token and keeps the access token in memory', async () => {
    fetch.mockResolvedValue(signedIn('access-1'))

    const me = await signInWithGoogle('google-id-token')

    expect(me).toEqual(ME)
    expect(getAccessToken()).toBe('access-1')
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/api/v1/auth/google')
    expect(JSON.parse(init.body)).toEqual({ id_token: 'google-id-token' })
  })

  it('sends the terms version only once the parent has ticked the box', async () => {
    fetch.mockResolvedValue(signedIn('access-1'))

    await signInWithGoogle('google-id-token', { acceptedTerms: true })

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      id_token: 'google-id-token',
      accepted_terms_version: TERMS_VERSION,
    })
  })

  it('turns 409 consent_required into ConsentRequiredError', async () => {
    fetch.mockResolvedValue(jsonResponse({ detail: 'consent_required' }, 409))

    await expect(signInWithGoogle('google-id-token')).rejects.toBeInstanceOf(ConsentRequiredError)
    expect(getAccessToken()).toBeNull()
  })

  it('fails with the status for any other error', async () => {
    fetch.mockResolvedValue(jsonResponse({ detail: 'Sign-in failed' }, 401))

    await expect(signInWithGoogle('bad')).rejects.toMatchObject({ status: 401 })
  })
})

describe('refreshSession', () => {
  it('uses the cookie and proves the request comes from our app', async () => {
    fetch.mockResolvedValue(signedIn('access-2'))

    const me = await refreshSession()

    expect(me).toEqual(ME)
    expect(getAccessToken()).toBe('access-2')
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/api/v1/auth/refresh')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('same-origin')
    expect(init.headers['X-Requested-With']).toBe('mathbuddy')
  })

  it('shares one request between callers at the same moment', async () => {
    fetch.mockResolvedValue(signedIn('access-2'))

    const [a, b] = await Promise.all([refreshSession(), refreshSession()])

    expect(a).toEqual(ME)
    expect(b).toEqual(ME)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retries once after a refresh race with another tab', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ detail: 'refresh_race' }, 409))
      .mockResolvedValueOnce(signedIn('access-3'))

    expect(await refreshSession()).toEqual(ME)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(getAccessToken()).toBe('access-3')
  })

  it('returns null and forgets the token when there is no session', async () => {
    fetch.mockResolvedValueOnce(signedIn('access-1'))
    await signInWithGoogle('google-id-token')
    fetch.mockResolvedValueOnce(jsonResponse({ detail: 'Not signed in' }, 401))

    expect(await refreshSession()).toBeNull()
    expect(getAccessToken()).toBeNull()
  })
})

describe('authFetch', () => {
  it('adds the access token', async () => {
    fetch.mockResolvedValueOnce(signedIn('access-1'))
    await signInWithGoogle('google-id-token')
    fetch.mockResolvedValueOnce(jsonResponse(ME))

    expect(await authFetch('/me')).toEqual(ME)
    const [url, init] = fetch.mock.calls[1]
    expect(url).toBe('/api/v1/me')
    expect(init.headers.Authorization).toBe('Bearer access-1')
  })

  it('refreshes once after a 401 and retries with the new token', async () => {
    fetch.mockResolvedValueOnce(signedIn('old'))
    await signInWithGoogle('google-id-token')
    fetch
      .mockResolvedValueOnce(jsonResponse({ detail: 'Not signed in' }, 401)) // expired
      .mockResolvedValueOnce(signedIn('new')) // refresh
      .mockResolvedValueOnce(jsonResponse(ME)) // retry

    expect(await authFetch('/me')).toEqual(ME)
    expect(fetch.mock.calls[3][1].headers.Authorization).toBe('Bearer new')
  })

  it('gives up with a 401 when the refresh fails too', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ detail: 'Not signed in' }, 401))
      .mockResolvedValueOnce(jsonResponse({ detail: 'Not signed in' }, 401))

    await expect(authFetch('/me')).rejects.toMatchObject({ status: 401 })
  })
})

describe('signOut', () => {
  it('ends the session on the server and forgets the token', async () => {
    fetch.mockResolvedValueOnce(signedIn('access-1'))
    await signInWithGoogle('google-id-token')
    fetch.mockResolvedValueOnce({ ok: true, status: 204, text: async () => '' })

    await signOut()

    const [url, init] = fetch.mock.calls[1]
    expect(url).toBe('/api/v1/auth/logout')
    expect(init.headers['X-Requested-With']).toBe('mathbuddy')
    expect(getAccessToken()).toBeNull()
  })
})
