/**
 * Sign-in plumbing. The only place that knows about tokens.
 *
 * - Access token (15 min): kept in memory only, never in localStorage. A page reload
 *   loses it, and refreshSession() gets a new one from the refresh cookie.
 * - Refresh token: an HttpOnly cookie (`mb_refresh`) set by the server. JavaScript
 *   cannot read it; the browser sends it to /api/v1/auth/* only.
 */

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api/v1`
  : '/api/v1'

/** Must match the backend's MATH_BUDDY_TERMS_VERSION. */
export const TERMS_VERSION = '2026-11-draft'

/** Cookie requests must carry this header (the server's CSRF check). */
const APP_HEADER = { 'X-Requested-With': 'mathbuddy' }

export class ConsentRequiredError extends Error {
  constructor() {
    super('consent_required')
    this.name = 'ConsentRequiredError'
  }
}

let accessToken = null
let refreshing = null // the one refresh in flight, shared by every caller in this tab
const signedOutListeners = new Set()

/**
 * Call `listener` when a request finds this device is no longer signed in (the refresh
 * failed too: unlinked by a parent, expired, or signed out elsewhere). Returns a stop function.
 */
export function onSignedOut(listener) {
  signedOutListeners.add(listener)
  return () => signedOutListeners.delete(listener)
}

export function getAccessToken() {
  return accessToken
}

/** Test helper: forget all state between tests. */
export function resetAuthForTests() {
  accessToken = null
  refreshing = null
}

async function readError(response) {
  let detail = null
  try {
    detail = JSON.parse(await response.text())?.detail ?? null
  } catch {
    // not JSON
  }
  const err = new Error(typeof detail === 'string' ? detail : `API error ${response.status}`)
  err.status = response.status
  err.detail = detail
  return err
}

function post(path, body, extraHeaders = {}) {
  return fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

/**
 * Parent sign-in with a Google ID token. Returns `me`.
 * Throws ConsentRequiredError for a new parent who has not ticked the terms box yet.
 */
export async function signInWithGoogle(idToken, { acceptedTerms = false } = {}) {
  const body = { id_token: idToken }
  if (acceptedTerms) body.accepted_terms_version = TERMS_VERSION
  const response = await post('/auth/google', body)
  if (!response.ok) {
    const err = await readError(response)
    if (err.status === 409 && err.detail === 'consent_required') throw new ConsentRequiredError()
    throw err
  }
  const data = await response.json()
  accessToken = data.access_token
  return data.me
}

async function doRefresh() {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await post('/auth/refresh', undefined, APP_HEADER)
    if (response.ok) {
      const data = await response.json()
      accessToken = data.access_token
      return data.me
    }
    // Another tab rotated the cookie a moment ago; the browser now has the new one.
    if (response.status === 409 && attempt === 0) continue
    break
  }
  accessToken = null
  return null
}

/** New access token from the refresh cookie. Returns `me`, or null when not signed in. */
export function refreshSession() {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

/** Sign this browser out (server ends the session and clears the cookie). */
export async function signOut() {
  try {
    await post('/auth/logout', undefined, APP_HEADER)
  } finally {
    accessToken = null
  }
}

/**
 * Authenticated JSON request. On a 401 it refreshes once and retries once.
 * Throws an error with `.status` when it still fails.
 */
export async function authFetch(path, { method = 'GET', body } = {}) {
  const send = () =>
    fetch(`${BASE_URL}${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

  let response = await send()
  if (response.status === 401) {
    if (await refreshSession()) {
      response = await send()
    } else {
      signedOutListeners.forEach((listener) => listener())
    }
  }
  if (!response.ok) throw await readError(response)
  return response.status === 204 ? null : response.json()
}

/**
 * A child's device: swap the one-time code from the parent for a child session.
 * Returns `me` ({ kind: 'child', profile }). Throws with `.status` (401 wrong code, 429 too many tries).
 */
export async function linkDevice(code) {
  const response = await post('/auth/link', { code })
  if (!response.ok) throw await readError(response)
  const data = await response.json()
  accessToken = data.access_token
  return data.me
}
