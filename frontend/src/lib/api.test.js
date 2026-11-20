import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateQuestions,
  fetchCurriculum,
  fetchLessonStatus,
  buildAttemptPayload,
  saveAttemptWithRetry,
  adminGet,
  addChild,
  updateChild,
  createLinkCode,
  cancelLinkCode,
  listChildren,
  listDevices,
  renameDevice,
  unlinkDevice,
  toProfile,
} from './api'
import { linkDevice, resetAuthForTests } from './auth'

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

const QUESTIONS = [
  { id: 'q1', topic: 'Variables', problem_type: 'lesson', text: '3n + 1', difficulty_tier: 1 },
]
const EVALUATION = {
  results: [{ questionId: 'q1', marks: 2, feedback: 'Nice', studentAnswer: '7', correctAnswer: '7' }],
  totalScore: 2,
  maxScore: 2,
}

beforeEach(() => {
  resetAuthForTests()
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('generateQuestions', () => {
  it('sends lesson_id only when a lesson is given', async () => {
    fetch.mockResolvedValue(jsonResponse({ questions: [], fun_facts: [] }))

    await generateQuestions(['Algebra'], '11-12', 30)
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      topics: ['Algebra'], age_group: '11-12', question_count: 30,
    })

    await generateQuestions(['Variables'], '11-12', 25, '10.3')
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ question_count: 25, lesson_id: '10.3' })
  })
})

describe('API errors', () => {
  it("shows the server's own message instead of raw JSON, and keeps the status", async () => {
    fetch.mockResolvedValue(jsonResponse({ detail: 'The AI helper is busy right now. Please try again in a moment.' }, 503))
    await expect(generateQuestions(['Algebra'], '11-12', 25, '7.1')).rejects.toMatchObject({
      message: 'The AI helper is busy right now. Please try again in a moment.',
      status: 503,
    })
  })

  it('falls back to the status and raw body when there is no string detail', async () => {
    fetch.mockResolvedValue(jsonResponse({ detail: [{ msg: 'bad' }] }, 422))
    await expect(generateQuestions(['Algebra'], '11-12', 25)).rejects.toMatchObject({
      message: expect.stringContaining('API error 422'),
      status: 422,
    })
  })
})

describe('child calls use the sign-in', () => {
  async function linkThisBrowser() {
    fetch.mockResolvedValueOnce(jsonResponse({
      access_token: 'child-token', expires_in: 900,
      me: { kind: 'child', profile: { id: 'c1', display_name: 'Aarav', grade: '7' } },
    }))
    await linkDevice('7K4Q-9PXM')
  }

  it.each([
    ['generateQuestions', () => generateQuestions(['Algebra'], '11-12', 30), { questions: [], fun_facts: [] }],
    ['fetchCurriculum', () => fetchCurriculum('7'), { units: [] }],
    ['fetchLessonStatus', () => fetchLessonStatus(), []],
    ['saveAttempt', () => saveAttemptWithRetry({ mode: 'adhoc' }, { delayMs: 0 }), { attempt_id: 'a1' }],
  ])('%s sends the access token', async (_name, call, reply) => {
    await linkThisBrowser()
    fetch.mockResolvedValueOnce(jsonResponse(reply))
    await call()
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer child-token')
  })

  it('fetchLessonStatus reads the signed-in child and keys rows by lesson id', async () => {
    fetch.mockResolvedValue(jsonResponse([
      { lesson_id: '10.3', completed: true, best_score_pct: 96 },
    ]))
    expect(await fetchLessonStatus()).toEqual({ '10.3': { completed: true, bestScorePct: 96 } })
    expect(fetch.mock.calls[0][0]).toBe('/api/v1/me/lesson-status')
  })
})

describe('buildAttemptPayload', () => {
  it('builds a curriculum attempt with no topic', () => {
    const p = buildAttemptPayload({
      lessonId: '10.3', topicId: 'ignored', questions: QUESTIONS, evaluationResult: EVALUATION,
    })
    expect(p).toMatchObject({
      mode: 'curriculum', lesson_id: '10.3', topic_id: null, score: 2, max_score: 2,
    })
    expect(p).not.toHaveProperty('profile_id') // the server takes the child from the sign-in
    expect(p.questions[0]).toEqual({
      id: 'q1', topic: 'Variables', problem_type: 'lesson', text: '3n + 1', difficulty_tier: 1,
    })
    expect(p.evaluation[0]).toEqual({
      question_id: 'q1', marks: 2, feedback: 'Nice', student_answer: '7', correct_answer: '7',
    })
  })

  it('builds an ad-hoc attempt with no lesson', () => {
    const p = buildAttemptPayload({
      lessonId: null, topicId: 'algebra+volumes', questions: QUESTIONS, evaluationResult: EVALUATION,
    })
    expect(p).toMatchObject({ mode: 'adhoc', lesson_id: null, topic_id: 'algebra+volumes' })
  })
})

describe('saveAttemptWithRetry', () => {
  const payload = { mode: 'adhoc' }

  it('saves once when the first try works', async () => {
    fetch.mockResolvedValue(jsonResponse({ attempt_id: 'a1' }, 201))
    expect(await saveAttemptWithRetry(payload, { delayMs: 0 })).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retries exactly once after a failure', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ detail: 'boom' }, 500))
      .mockResolvedValueOnce(jsonResponse({ attempt_id: 'a1' }, 201))
    expect(await saveAttemptWithRetry(payload, { delayMs: 0 })).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('gives up (resolves false, never throws) after the retry also fails', async () => {
    fetch.mockRejectedValue(new Error('offline'))
    expect(await saveAttemptWithRetry(payload, { delayMs: 0 })).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe('adminGet', () => {
  it('sends the token header and exposes the status on errors', async () => {
    fetch.mockResolvedValueOnce(jsonResponse([], 200))
    await adminGet('secret', '/profiles')
    expect(fetch.mock.calls[0][0]).toContain('/admin/profiles')
    expect(fetch.mock.calls[0][1].headers['X-Admin-Token']).toBe('secret')

    fetch.mockResolvedValueOnce(jsonResponse({ detail: 'Not Found' }, 404))
    await expect(adminGet('bad', '/profiles')).rejects.toMatchObject({ status: 404 })
  })
})


describe('children (parent only)', () => {
  it('adds a child with a name and a grade', async () => {
    const child = { id: 'c1', display_name: 'Aarav', grade: '7' }
    fetch.mockResolvedValue(jsonResponse(child, 201))

    expect(await addChild({ displayName: 'Aarav', grade: '7' })).toEqual(child)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/api/v1/children')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ display_name: 'Aarav', grade: '7' })
  })

  it('changes only what is given', async () => {
    fetch.mockResolvedValue(jsonResponse({ id: 'c1', display_name: 'Aaru', grade: '7' }))

    await updateChild('c1', { displayName: 'Aaru' })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/api/v1/children/c1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ display_name: 'Aaru' })
  })
})


describe('createLinkCode', () => {
  it('asks for a code for one child', async () => {
    fetch.mockResolvedValue(jsonResponse({ code: '7K4Q-9PXM', expires_at: '2026-11-20T10:10:00Z' }, 201))

    expect(await createLinkCode('c1')).toEqual({ code: '7K4Q-9PXM', expiresAt: '2026-11-20T10:10:00Z' })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/api/v1/children/c1/link-codes')
    expect(init.method).toBe('POST')
  })
})

describe('toProfile', () => {
  it('handles a child added by a parent, who has no email', () => {
    expect(toProfile({ id: 'c1', display_name: 'Aarav', grade: '7' })).toEqual({
      id: 'c1', email: null, displayName: 'Aarav', grade: '7',
    })
  })
})


describe('linked devices (parent only)', () => {
  it('lists the children with their device counts', async () => {
    const children = [{ id: 'c1', display_name: 'Aarav', grade: '7', linked_devices: 1 }]
    fetch.mockResolvedValue(jsonResponse(children))
    expect(await listChildren()).toEqual(children)
    expect(fetch.mock.calls[0][0]).toBe('/api/v1/children')
  })

  it('cancels the unused code of one child', async () => {
    fetch.mockResolvedValue({ ok: true, status: 204, text: async () => '' })
    await cancelLinkCode('c1')
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/api/v1/children/c1/link-codes')
    expect(init.method).toBe('DELETE')
  })

  it("lists a child's devices", async () => {
    fetch.mockResolvedValue(
      jsonResponse([
        {
          session_id: 's1',
          device_name: 'Chrome on Windows',
          created_at: '2026-11-18T10:00:00Z',
          last_used_at: '2026-11-20T09:00:00Z',
        },
      ])
    )
    expect(await listDevices('c1')).toEqual([
      { id: 's1', name: 'Chrome on Windows', createdAt: '2026-11-18T10:00:00Z', lastUsedAt: '2026-11-20T09:00:00Z' },
    ])
    expect(fetch.mock.calls[0][0]).toBe('/api/v1/children/c1/devices')
  })

  it('renames a device', async () => {
    fetch.mockResolvedValue(
      jsonResponse({ session_id: 's1', device_name: 'Laptop', created_at: 'a', last_used_at: 'b' })
    )
    expect(await renameDevice('s1', 'Laptop')).toEqual({ id: 's1', name: 'Laptop', createdAt: 'a', lastUsedAt: 'b' })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/api/v1/devices/s1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ device_name: 'Laptop' })
  })

  it('unlinks a device', async () => {
    fetch.mockResolvedValue({ ok: true, status: 204, text: async () => '' })
    await unlinkDevice('s1')
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/api/v1/devices/s1')
    expect(init.method).toBe('DELETE')
  })
})
