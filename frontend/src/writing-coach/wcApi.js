/**
 * API client for the Writing Coach. Every call goes to /api/v1/wc/... and carries the
 * profile id the app already holds. Self-contained so the feature can be removed cleanly.
 */

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api/v1/wc`
  : '/api/v1/wc'

async function request(method, path, { profileId, adminToken, body } = {}) {
  const headers = {}
  if (profileId) headers['X-Profile-Id'] = profileId
  if (adminToken) headers['X-Admin-Token'] = adminToken
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    let message = `Something went wrong (${response.status}). Please try again.`
    try {
      const { detail } = await response.json()
      if (typeof detail === 'string' && detail) message = detail
      else if (Array.isArray(detail) && detail[0]?.msg) message = detail[0].msg
    } catch {
      // not JSON — keep the generic message
    }
    const err = new Error(message)
    err.status = response.status
    throw err
  }
  return response.json()
}

export const wc = {
  reminder: (profileId) => request('GET', '/reminder', { profileId }),
  createSession: (profileId, body) => request('POST', '/sessions', { profileId, body }),
  listSessions: (profileId) => request('GET', '/sessions', { profileId }),
  getSession: (profileId, id) => request('GET', `/sessions/${id}`, { profileId }),
  report: (profileId, id) => request('GET', `/sessions/${id}/report`, { profileId }),
  decode: (profileId, id, body) => request('POST', `/sessions/${id}/decode`, { profileId, body }),
  read: (profileId, id, kind, images) =>
    request('POST', `/sessions/${id}/read`, { profileId, body: { kind, images } }),
  confirm: (profileId, submissionId, text) =>
    request('PUT', `/submissions/${submissionId}/transcript`, { profileId, body: { text } }),
  review: (profileId, submissionId) =>
    request('POST', `/submissions/${submissionId}/review`, { profileId }),
  modelAnswer: (profileId, id) => request('GET', `/sessions/${id}/model-answer`, { profileId }),
  finish: (profileId, id, body) => request('PATCH', `/sessions/${id}`, { profileId, body }),
  overview: (profileId) => request('GET', '/overview', { profileId }),
}

/** Parent (admin token) calls, used by the Writing Coach tab on the admin page. */
export const wcParent = {
  sessions: (adminToken, profileId) =>
    request('GET', `/parent/sessions?profile_id=${encodeURIComponent(profileId)}`, { adminToken }),
  conventions: (adminToken, profileId) =>
    request('GET', `/parent/conventions?profile_id=${encodeURIComponent(profileId)}`, { adminToken }),
  getSettings: (adminToken, profileId) =>
    request('GET', `/parent/settings?profile_id=${encodeURIComponent(profileId)}`, { adminToken }),
  putSettings: (adminToken, profileId, body) =>
    request('PUT', `/parent/settings?profile_id=${encodeURIComponent(profileId)}`, { adminToken, body }),
}
