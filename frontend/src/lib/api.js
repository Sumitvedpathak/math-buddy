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
export async function generateQuestions(topics, ageGroup, questionCount) {
  return postJson('/questions/generate', {
    topics,
    age_group: ageGroup,
    question_count: questionCount,
  })
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
