import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateQuestions,
  lookupProfile,
  createProfile,
  fetchLessonStatus,
  buildAttemptPayload,
  saveAttemptWithRetry,
  adminGet,
} from './api'

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

describe('profiles', () => {
  it('lookupProfile returns null when nothing exists and never POSTs', async () => {
    fetch.mockResolvedValue(jsonResponse({ exists: false, profile: null }))
    expect(await lookupProfile('new@example.com')).toBeNull()
    expect(fetch.mock.calls[0][0]).toContain('/profiles/lookup?email=new%40example.com')
    expect(fetch.mock.calls[0][1].method).toBeUndefined()
  })

  it('lookupProfile maps the profile to camelCase', async () => {
    fetch.mockResolvedValue(jsonResponse({
      exists: true,
      profile: { id: 'p1', email: 'a@b.co', display_name: 'Sam', grade: '7', created_at: 'x' },
    }))
    expect(await lookupProfile('a@b.co')).toEqual({ id: 'p1', email: 'a@b.co', displayName: 'Sam', grade: '7' })
  })

  it('createProfile POSTs snake_case fields', async () => {
    fetch.mockResolvedValue(jsonResponse(
      { id: 'p1', email: 'a@b.co', display_name: 'Sam', grade: '6', created_at: 'x' }, 201))
    const profile = await createProfile({ email: 'a@b.co', displayName: 'Sam', grade: '6' })
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ email: 'a@b.co', display_name: 'Sam', grade: '6' })
    expect(profile.displayName).toBe('Sam')
  })

  it('fetchLessonStatus keys rows by lesson id', async () => {
    fetch.mockResolvedValue(jsonResponse([
      { lesson_id: '10.3', completed: true, best_score_pct: 96 },
    ]))
    expect(await fetchLessonStatus('p1')).toEqual({ '10.3': { completed: true, bestScorePct: 96 } })
  })
})

describe('buildAttemptPayload', () => {
  it('builds a curriculum attempt with no topic', () => {
    const p = buildAttemptPayload({
      profileId: 'p1', lessonId: '10.3', topicId: 'ignored', questions: QUESTIONS, evaluationResult: EVALUATION,
    })
    expect(p).toMatchObject({
      profile_id: 'p1', mode: 'curriculum', lesson_id: '10.3', topic_id: null, score: 2, max_score: 2,
    })
    expect(p.questions[0]).toEqual({
      id: 'q1', topic: 'Variables', problem_type: 'lesson', text: '3n + 1', difficulty_tier: 1,
    })
    expect(p.evaluation[0]).toEqual({
      question_id: 'q1', marks: 2, feedback: 'Nice', student_answer: '7', correct_answer: '7',
    })
  })

  it('builds an ad-hoc attempt with no lesson', () => {
    const p = buildAttemptPayload({
      profileId: 'p1', lessonId: null, topicId: 'algebra+volumes', questions: QUESTIONS, evaluationResult: EVALUATION,
    })
    expect(p).toMatchObject({ mode: 'adhoc', lesson_id: null, topic_id: 'algebra+volumes' })
  })
})

describe('saveAttemptWithRetry', () => {
  const payload = { profile_id: 'p1' }

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
