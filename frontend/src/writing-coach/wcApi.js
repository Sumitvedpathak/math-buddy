/**
 * API client for the Writing Coach, under /api/v1/wc/.... The child's calls use the
 * sign-in (lib/auth.js); the parent's calls on the admin page use the admin token.
 * Self-contained so the feature can be removed cleanly.
 */

import { authFetch } from '../lib/auth'

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api/v1/wc`
  : '/api/v1/wc'

/** The message to show: the server's own, the first validation message, or a generic one. */
function friendlyError(status, detail) {
  let message = `Something went wrong (${status}). Please try again.`
  if (typeof detail === 'string' && detail) message = detail
  else if (Array.isArray(detail) && detail[0]?.msg) message = detail[0].msg
  const err = /** @type {Error & {status?: number, detail?: any}} */ (new Error(message))
  err.status = status
  return err
}

/** A call by the signed-in child. */
async function asChild(method, path, body) {
  try {
    return await authFetch(`/wc${path}`, { method, body })
  } catch (err) {
    if (err?.status === undefined) throw err // network error: keep it as it is
    throw friendlyError(err.status, err.detail)
  }
}

/**
 * A call from the admin page.
 * @param {string} method
 * @param {string} path
 * @param {{ adminToken?: string, body?: any }} [options]
 */
async function request(method, path, { adminToken = undefined, body = undefined } = {}) {
  /** @type {Record<string, string>} */
  const headers = {}
  if (adminToken) headers['X-Admin-Token'] = adminToken
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    let detail = null
    try {
      detail = (await response.json())?.detail ?? null
    } catch {
      // not JSON — keep the generic message
    }
    throw friendlyError(response.status, detail)
  }
  return response.json()
}

/*
 * The child's calls. A profile id passed in (`_profileId`) is no longer sent: the server
 * takes the child from the sign-in. It stays so the screens, which re-load when the
 * profile changes, did not all have to change for the sign-in work.
 */
export const wc = {
  reminder: () => asChild('GET', '/reminder'),
  createSession: (_profileId, body) => asChild('POST', '/sessions', body),
  listSessions: () => asChild('GET', '/sessions'),
  getSession: (_profileId, id) => asChild('GET', `/sessions/${id}`),
  report: (_profileId, id) => asChild('GET', `/sessions/${id}/report`),
  decode: (_profileId, id, body) => asChild('POST', `/sessions/${id}/decode`, body),
  read: (_profileId, id, kind, images) => asChild('POST', `/sessions/${id}/read`, { kind, images }),
  confirm: (_profileId, submissionId, text) =>
    asChild('PUT', `/submissions/${submissionId}/transcript`, { text }),
  review: (_profileId, submissionId) => asChild('POST', `/submissions/${submissionId}/review`),
  modelAnswer: (_profileId, id) => asChild('POST', `/sessions/${id}/model-answer`),
  overview: () => asChild('GET', '/overview'),
}

/** Parent (admin token) calls, used by the Writing Coach tab on the admin page. */
export const wcParent = {
  sessions: (adminToken, profileId) =>
    request('GET', `/parent/sessions?profile_id=${encodeURIComponent(profileId)}`, { adminToken }),
  progress: (adminToken, profileId) =>
    request('GET', `/parent/progress?profile_id=${encodeURIComponent(profileId)}`, { adminToken }),
  getSettings: (adminToken, profileId) =>
    request('GET', `/parent/settings?profile_id=${encodeURIComponent(profileId)}`, { adminToken }),
  putSettings: (adminToken, profileId, body) =>
    request('PUT', `/parent/settings?profile_id=${encodeURIComponent(profileId)}`, { adminToken, body }),
}
