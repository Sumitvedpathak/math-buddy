import { createContext, useContext, useState, useCallback } from 'react'
import { generateQuestions, evaluateAnswers } from '../lib/api'
import FALLBACK_FUN_FACTS from '../lib/fallbackFacts'

/**
 * @typedef {import('../lib/api').Question} Question
 * @typedef {import('../lib/api').Answer} Answer
 * @typedef {import('../lib/api').EvaluationResult} EvaluationResult
 */

/**
 * @typedef {"home"|"loading"|"practice"|"evaluating"|"dashboard"} AppScreen
 */

/**
 * @typedef {Object} SessionState
 * @property {AppScreen} screen
 * @property {string} ageGroup
 * @property {string[]} selectedTopics
 * @property {number} questionCount
 * @property {Question[]} questions
 * @property {string[]} funFacts
 * @property {Record<string, Answer>} answers
 * @property {EvaluationResult|null} evaluationResult
 * @property {{message: string, retryFn: () => void}|null} error
 */

/** @type {React.Context<any>} */
export const SessionContext = createContext(null)

const INITIAL_STATE = {
  screen: 'home',
  ageGroup: '9-10',
  selectedTopics: [],
  questionCount: 30,
  questions: [],
  funFacts: [],
  answers: {},
  evaluationResult: null,
  error: null,
}

/**
 * @param {{ children: React.ReactNode }} props
 */
export function SessionProvider({ children }) {
  const [state, setState] = useState(INITIAL_STATE)

  const setAgeGroup = useCallback((ageGroup) => {
    setState((s) => ({ ...s, ageGroup }))
  }, [])

  const toggleTopic = useCallback((topicId) => {
    setState((s) => {
      const exists = s.selectedTopics.includes(topicId)
      return {
        ...s,
        selectedTopics: exists
          ? s.selectedTopics.filter((t) => t !== topicId)
          : [...s.selectedTopics, topicId],
      }
    })
  }, [])

  const setQuestionCount = useCallback((count) => {
    setState((s) => ({ ...s, questionCount: count }))
  }, [])

  const setAnswer = useCallback((questionId, mode, content) => {
    setState((s) => ({
      ...s,
      answers: { ...s.answers, [questionId]: { questionId, mode, content } },
    }))
  }, [])

  const startSession = useCallback(async () => {
    setState((s) => ({ ...s, screen: 'loading', error: null, funFacts: FALLBACK_FUN_FACTS }))
    try {
      const data = await generateQuestions(
        state.selectedTopics,
        state.ageGroup,
        state.questionCount
      )
      setState((s) => ({
        ...s,
        questions: data.questions,
        funFacts: data.fun_facts,
        answers: {},
        screen: 'practice',
      }))
    } catch (err) {
      const retryFn = () => startSession()
      setState((s) => ({
        ...s,
        screen: 'home',
        error: {
          message: 'Could not generate questions. Please check your connection and try again.',
          retryFn,
        },
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedTopics, state.ageGroup, state.questionCount])

  const submitAnswers = useCallback(async (exportedAnswers) => {
    setState((s) => ({ ...s, screen: 'evaluating', error: null }))
    try {
      // exportedAnswers may be a Record or array — normalise to array, filter empty
      const answersArray = (Array.isArray(exportedAnswers)
        ? exportedAnswers
        : Object.values(exportedAnswers)
      ).filter((a) => a && a.content && a.content.length > 0)
      console.debug('[submitAnswers] sending', answersArray.length, 'answers', 
        answersArray.map(a => ({ id: a.questionId, mode: a.mode, contentLen: a.content?.length })))
      const result = await evaluateAnswers(state.questions, answersArray)
      setState((s) => ({ ...s, evaluationResult: result, screen: 'dashboard' }))
    } catch (err) {
      const retryFn = () => submitAnswers(exportedAnswers)
      setState((s) => ({
        ...s,
        screen: 'practice',
        error: {
          message: 'Could not evaluate answers. Please check your connection and try again.',
          retryFn,
        },
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.questions])

  const resetSession = useCallback(() => {
    setState((s) => ({
      ...INITIAL_STATE,
      ageGroup: s.ageGroup,
      selectedTopics: s.selectedTopics,
      questionCount: s.questionCount,
      screen: 'home',
    }))
  }, [])

  const goHome = useCallback(() => {
    setState((s) => ({ ...INITIAL_STATE, ageGroup: s.ageGroup, selectedTopics: s.selectedTopics, questionCount: s.questionCount, screen: 'home' }))
  }, [])

  const actions = {
    setAgeGroup,
    toggleTopic,
    setQuestionCount,
    setAnswer,
    startSession,
    submitAnswers,
    resetSession,
    goHome,
  }

  return (
    <SessionContext.Provider value={{ state, ...actions }}>
      {children}
    </SessionContext.Provider>
  )
}

/** @returns {{ state: SessionState, actions: typeof import('./SessionContext').actions }} */
export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
