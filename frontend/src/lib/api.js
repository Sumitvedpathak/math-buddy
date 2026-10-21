/**
 * @typedef {Object} Question
 * @property {string} id
 * @property {string} topic
 * @property {"multiplication"|"division"|"fractions"|"mixed_fractions"|"squares"} problemType
 * @property {string} text
 * @property {number} difficultyTier
 */

/**
 * @typedef {Object} Answer
 * @property {string} questionId
 * @property {"sketch"|"text"} mode
 * @property {string} content
 */

/**
 * @typedef {Object} EvaluationResult
 * @property {Array<{questionId: string, marks: 0|1|2, feedback: string, studentAnswer?: string, correctAnswer?: string}>} results
 * @property {number} totalScore
 * @property {number} maxScore
 * @property {Record<string, {score: number, maxScore: number, questionCount: number}>} topicBreakdown
 */

const BASE_URL = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api/v1` 
  : '/api/v1'

/**
 * @param {string} url
 * @param {Object} body
 * @returns {Promise<Object>}
 */
async function postJson(url, body) {
  const response = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`API error ${response.status}: ${detail}`)
  }
  return response.json()
}

/**
 * Generate questions for a session.
 *
 * @param {string[]} topics
 * @param {"9-10"|"11-12"} ageGroup
 * @param {number} questionCount
 * @returns {Promise<{questions: Question[], fun_facts: string[]}>}
 */
export async function generateQuestions(topics, ageGroup, questionCount, lessonId) {
  return postJson('/questions/generate', {
    topics,
    age_group: ageGroup,
    question_count: questionCount,
    ...(lessonId ? { lesson_id: lessonId } : {}),
  })
}

/** @param {string} url */
async function getJson(url, headers = {}) {
  const response = await fetch(`${BASE_URL}${url}`, { headers })
  if (!response.ok) {
    const detail = await response.text()
    const err = new Error(`API error ${response.status}: ${detail}`)
    err.status = response.status
    throw err
  }
  return response.json()
}

/**
 * @typedef {Object} Profile
 * @property {string} id
 * @property {string} email
 * @property {string} displayName
 * @property {"6"|"7"} grade
 */

function toProfile(raw) {
  return { id: raw.id, email: raw.email, displayName: raw.display_name, grade: raw.grade }
}

/**
 * Read-only existence check — never creates a profile.
 * @param {string} email
 * @returns {Promise<Profile|null>}
 */
export async function lookupProfile(email) {
  const raw = await getJson(`/profiles/lookup?email=${encodeURIComponent(email)}`)
  return raw.exists ? toProfile(raw.profile) : null
}

/**
 * Create a profile. Only call after the user has explicitly confirmed.
 * @param {{email: string, displayName: string, grade: "6"|"7"}} input
 * @returns {Promise<Profile>}
 */
export async function createProfile({ email, displayName, grade }) {
  return toProfile(
    await postJson('/profiles', { email, display_name: displayName, grade })
  )
}

/**
 * Static unit/lesson content for a grade.
 * @param {"6"|"7"} grade
 * @returns {Promise<Array<{id: string, number: number, title: string, lessons: Array<{id: string, title: string, focus: string, keywords: string[]}>}>>}
 */
export async function fetchCurriculum(grade) {
  const raw = await getJson(`/curriculum?grade=${encodeURIComponent(grade)}`)
  return raw.units
}

/**
 * Current completion state per attempted lesson, keyed by lesson id.
 * @param {string} profileId
 * @returns {Promise<Record<string, {completed: boolean, bestScorePct: number}>>}
 */
export async function fetchLessonStatus(profileId) {
  const rows = await getJson(`/profiles/${profileId}/lesson-status`)
  return Object.fromEntries(
    rows.map((r) => [r.lesson_id, { completed: r.completed, bestScorePct: r.best_score_pct }])
  )
}

/**
 * Build the POST /attempts body from a finished, evaluated session.
 * Exactly one of lessonId / topicId must be set (curriculum vs ad-hoc).
 *
 * @param {{profileId: string, lessonId?: string|null, topicId?: string|null, questions: Question[], evaluationResult: EvaluationResult}} args
 */
export function buildAttemptPayload({ profileId, lessonId, topicId, questions, evaluationResult }) {
  return {
    profile_id: profileId,
    mode: lessonId ? 'curriculum' : 'adhoc',
    lesson_id: lessonId || null,
    topic_id: lessonId ? null : topicId,
    questions: questions.map((q) => ({
      id: q.id,
      topic: q.topic,
      problem_type: q.problem_type ?? q.problemType,
      text: q.text,
      difficulty_tier: q.difficulty_tier ?? q.difficultyTier,
    })),
    evaluation: evaluationResult.results.map((r) => ({
      question_id: r.questionId,
      marks: r.marks,
      feedback: r.feedback,
      student_answer: r.studentAnswer ?? null,
      correct_answer: r.correctAnswer ?? null,
    })),
    score: evaluationResult.totalScore,
    max_score: evaluationResult.maxScore,
  }
}

/**
 * @param {ReturnType<typeof buildAttemptPayload>} payload
 * @returns {Promise<{attempt_id: string, score_pct: number, mastered: boolean, lesson: {lesson_id: string, completed: boolean, best_score_pct: number}|null}>}
 */
export async function saveAttempt(payload) {
  return postJson('/attempts', payload)
}

/**
 * Save an attempt, retrying once after a short pause. Resolves true on success,
 * false if both tries fail — callers must never block the child on a failed save.
 *
 * @param {ReturnType<typeof buildAttemptPayload>} payload
 * @param {{delayMs?: number}} [options]
 * @returns {Promise<boolean>}
 */
export async function saveAttemptWithRetry(payload, { delayMs = 1000 } = {}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await saveAttempt(payload)
      return true
    } catch (err) {
      console.warn('[saveAttempt] failed', attempt + 1, err)
      if (attempt === 0 && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }
  return false
}

/* ── Admin (read-only; X-Admin-Token on every call) ── */

/**
 * @param {string} token
 * @param {string} path - e.g. "/profiles"
 */
export function adminGet(token, path) {
  return getJson(`/admin${path}`, { 'X-Admin-Token': token })
}

/**
 * Evaluate submitted answers.
 *
 * @param {Question[]} questions
 * @param {Answer[]} answers
 * @returns {Promise<EvaluationResult>}
 */
export async function evaluateAnswers(questions, answers) {
  // Map camelCase frontend shapes to snake_case API schema
  const payload = {
    questions: questions.map((q) => ({
      id: q.id,
      topic: q.topic,
      problem_type: q.problem_type ?? q.problemType,
      text: q.text,
      difficulty_tier: q.difficulty_tier ?? q.difficultyTier,
    })),
    answers: answers.map((a) => ({
      question_id: a.questionId ?? a.question_id,
      mode: a.mode,
      content: a.content,
    })),
  }
  const raw = await postJson('/answers/evaluate', payload)
  // Normalise snake_case response to camelCase for frontend
  return {
    results: raw.results.map((r) => ({
      questionId: r.question_id,
      marks: r.marks,
      feedback: r.feedback,
      studentAnswer: r.student_answer ?? undefined,
      correctAnswer: r.correct_answer ?? undefined,
    })),
    totalScore: raw.total_score,
    maxScore: raw.max_score,
    topicBreakdown: Object.fromEntries(
      Object.entries(raw.topic_breakdown).map(([k, v]) => [
        k,
        { score: v.score, maxScore: v.max_score, questionCount: v.question_count },
      ])
    ),
  }
}
