import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import {
  generateQuestions,
  evaluateAnswers,
  lookupProfile,
  createProfile,
  fetchCurriculum,
  fetchLessonStatus,
  buildAttemptPayload,
  saveAttemptWithRetry,
} from '../lib/api'
import FALLBACK_FUN_FACTS from '../lib/fallbackFacts'

/**
 * @typedef {import('../lib/api').Question} Question
 * @typedef {import('../lib/api').Answer} Answer
 * @typedef {import('../lib/api').EvaluationResult} EvaluationResult
 * @typedef {import('../lib/api').Profile} Profile
 */

/**
 * @typedef {"profile"|"home"|"loading"|"practice"|"evaluating"|"dashboard"|"leaderboard"|"about"} AppScreen
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
 * @property {Profile|null} profile - the loaded child profile (identity only is cached in localStorage)
 * @property {"none"|"loading"|"ready"} profileStatus
 * @property {AppScreen|null} pendingScreen - where to go once a profile has been loaded
 * @property {Array} curriculum - units for the profile's grade (empty for grade 6)
 * @property {Record<string, {completed: boolean, bestScorePct: number}>} lessonStatus
 * @property {string|null} lessonId - set while a curriculum lesson session is active
 * @property {"idle"|"saving"|"saved"|"failed"} saveStatus
 */

/** Curriculum lessons always use a fixed-size question set. */
export const CURRICULUM_QUESTION_COUNT = 25

/** profiles.grade maps 1:1 onto the existing question-generation age groups. */
const GRADE_TO_AGE_GROUP = { 6: '9-10', 7: '11-12' }

const PROFILE_STORAGE_KEY = 'mathBuddy.profile'

/** Identity only ({ profileId, email }) — never progress data. */
function readCachedIdentity() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROFILE_STORAGE_KEY))
    return parsed?.profileId && parsed?.email ? parsed : null
  } catch {
    return null
  }
}

function writeCachedIdentity(profile) {
  try {
    window.localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({ profileId: profile.id, email: profile.email })
    )
  } catch {
    // storage unavailable (private window etc.) — the app still works, just re-asks next visit
  }
}

function clearCachedIdentity() {
  try {
    window.localStorage.removeItem(PROFILE_STORAGE_KEY)
  } catch {
    // ignore
  }
}

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
  profile: null,
  profileStatus: 'none',
  pendingScreen: null,
  curriculum: [],
  lessonStatus: {},
  lessonId: null,
  saveStatus: 'idle',
}

/** Settings and the loaded profile survive a session reset; everything session-specific does not. */
function carryOver(s) {
  return {
    ageGroup: s.ageGroup,
    selectedTopics: s.selectedTopics,
    questionCount: s.questionCount,
    profile: s.profile,
    profileStatus: s.profileStatus,
    curriculum: s.curriculum,
    lessonStatus: s.lessonStatus,
  }
}

/**
 * @param {{ children: React.ReactNode }} props
 */
export function SessionProvider({ children }) {
  const cachedIdentityRef = useRef(undefined)
  if (cachedIdentityRef.current === undefined) {
    cachedIdentityRef.current = readCachedIdentity()
  }

  const [state, setState] = useState(() =>
    cachedIdentityRef.current
      ? { ...INITIAL_STATE, profileStatus: 'loading' }
      : { ...INITIAL_STATE, screen: 'profile' }
  )

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

  /* ── Profiles ── */

  /** Read-only existence check. Resolves to a Profile or null; never creates. */
  const findProfile = useCallback((email) => lookupProfile(email), [])

  /** Create a profile — callers must only do this after explicit user confirmation. */
  const registerProfile = useCallback((input) => createProfile(input), [])

  const refreshLessonStatus = useCallback(async (profileId) => {
    try {
      const lessonStatus = await fetchLessonStatus(profileId)
      setState((s) => ({ ...s, lessonStatus }))
    } catch (err) {
      console.warn('[refreshLessonStatus] failed', err)
    }
  }, [])

  /**
   * Make `profile` the active one: load its curriculum + lesson status, cache its
   * identity, and set the age group from its grade. Throws if the curriculum can't load.
   */
  const enterProfile = useCallback(async (profile, { keepScreen = false } = {}) => {
    const [curriculum, lessonStatus] = await Promise.all([
      fetchCurriculum(profile.grade),
      fetchLessonStatus(profile.id).catch((err) => {
        console.warn('[enterProfile] lesson status unavailable', err)
        return {}
      }),
    ])
    writeCachedIdentity(profile)
    setState((s) => ({
      ...s,
      profile,
      profileStatus: 'ready',
      ageGroup: GRADE_TO_AGE_GROUP[profile.grade] ?? s.ageGroup,
      curriculum,
      lessonStatus,
      error: null,
      screen: keepScreen ? s.screen : s.pendingScreen || 'home',
      pendingScreen: null,
    }))
  }, [])

  /** Forget the active profile (e.g. a sibling using the same device). */
  const switchProfile = useCallback(() => {
    clearCachedIdentity()
    setState({ ...INITIAL_STATE, screen: 'profile' })
  }, [])

  // Auto-resume the cached profile on the same browser.
  useEffect(() => {
    const cached = cachedIdentityRef.current
    if (!cached) return undefined
    let cancelled = false

    async function resume() {
      try {
        const profile = await lookupProfile(cached.email)
        if (cancelled) return
        if (!profile) {
          clearCachedIdentity()
          setState((s) => ({ ...s, profileStatus: 'none', screen: 'profile' }))
          return
        }
        await enterProfile(profile, { keepScreen: true })
      } catch (err) {
        if (cancelled) return
        console.error('[resumeProfile] error:', err)
        setState((s) => ({
          ...s,
          profileStatus: 'none',
          screen: 'profile',
          error: {
            message: 'Could not load your profile. Please check your connection and try again.',
            retryFn: () => {
              setState((cur) => ({ ...cur, error: null, profileStatus: 'loading', screen: 'home' }))
              resume()
            },
          },
        }))
      }
    }

    resume()
    return () => {
      cancelled = true
    }
  }, [enterProfile])

  /* ── Sessions ── */

  const runGeneration = useCallback(async ({ topics, ageGroup, count, lessonId }) => {
    setState((s) => ({
      ...s,
      screen: 'loading',
      error: null,
      funFacts: FALLBACK_FUN_FACTS,
      lessonId: lessonId ?? null,
      evaluationResult: null,
      saveStatus: 'idle',
    }))
    try {
      const data = await generateQuestions(topics, ageGroup, count, lessonId)
      setState((s) => ({
        ...s,
        questions: data.questions,
        funFacts: data.fun_facts,
        answers: {},
        screen: 'practice',
      }))
    } catch (err) {
      console.error('[startSession] error:', err)
      const message = typeof err === 'string'
        ? err
        : (err?.message || 'Could not generate questions. Please check your connection and try again.')

      setState((s) => ({
        ...s,
        screen: 'home',
        lessonId: null,
        error: {
          message,
          retryFn: () => runGeneration({ topics, ageGroup, count, lessonId }),
        },
      }))
    }
  }, [])

  const startSession = useCallback(
    () => runGeneration({
      topics: state.selectedTopics,
      ageGroup: state.ageGroup,
      count: state.questionCount,
      lessonId: null,
    }),
    [runGeneration, state.selectedTopics, state.ageGroup, state.questionCount]
  )

  /** Start a fixed-size curriculum session for one lesson. Also used for "retry with fresh questions". */
  const startLesson = useCallback((lessonId) => {
    const lesson = state.curriculum
      .flatMap((u) => u.lessons)
      .find((l) => l.id === lessonId)
    if (!lesson) return undefined
    return runGeneration({
      topics: [lesson.title],
      ageGroup: state.ageGroup,
      count: CURRICULUM_QUESTION_COUNT,
      lessonId,
    })
  }, [runGeneration, state.curriculum, state.ageGroup])

  /** Persist the finished session in the background; never blocks the child. */
  const persistAttempt = useCallback(async (result) => {
    if (!state.profile) return
    const payload = buildAttemptPayload({
      profileId: state.profile.id,
      lessonId: state.lessonId,
      topicId: [...state.selectedTopics].sort().join('+') || 'adhoc',
      questions: state.questions,
      evaluationResult: result,
    })
    setState((s) => ({ ...s, saveStatus: 'saving' }))
    const saved = await saveAttemptWithRetry(payload)
    setState((s) => ({ ...s, saveStatus: saved ? 'saved' : 'failed' }))
    if (saved) refreshLessonStatus(state.profile.id)
  }, [state.profile, state.lessonId, state.selectedTopics, state.questions, refreshLessonStatus])

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
      persistAttempt(result)
    } catch (err) {
      console.error('[submitAnswers] error:', err)
      const message = typeof err === 'string'
        ? err
        : (err?.message || 'Could not evaluate answers. Please check your connection and try again.')

      setState((s) => ({
        ...s,
        screen: 'practice',
        error: {
          message,
          retryFn: () => submitAnswers(exportedAnswers),
        },
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.questions, persistAttempt])

  const resetSession = useCallback(() => {
    setState((s) => ({ ...INITIAL_STATE, ...carryOver(s), screen: 'home' }))
  }, [])

  const goHome = useCallback(() => {
    setState((s) => ({ ...INITIAL_STATE, ...carryOver(s), screen: 'home' }))
  }, [])

  // Changes screen without resetting any session state — safe for nav links.
  // Practising needs a profile, so without one we detour via the profile screen.
  const navigateTo = useCallback((screen) => {
    setState((s) =>
      screen === 'practice' && !s.profile
        ? { ...s, screen: 'profile', pendingScreen: 'practice' }
        : { ...s, screen }
    )
  }, [])

  const actions = {
    setAgeGroup,
    toggleTopic,
    setQuestionCount,
    setAnswer,
    startSession,
    startLesson,
    submitAnswers,
    resetSession,
    goHome,
    navigateTo,
    findProfile,
    registerProfile,
    enterProfile,
    switchProfile,
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
