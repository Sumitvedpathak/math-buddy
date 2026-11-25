import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import {
  generateQuestions,
  evaluateAnswers,
  fetchCurriculum,
  fetchLessonStatus,
  buildAttemptPayload,
  saveAttemptWithRetry,
  toProfile,
} from '../lib/api'
import FALLBACK_FUN_FACTS from '../lib/fallbackFacts'
import { linkDevice, onSignedOut, refreshSession } from '../lib/auth'
import { openParentArea } from '../lib/navigation'

/**
 * @typedef {import('../lib/api').Question} Question
 * @typedef {import('../lib/api').Answer} Answer
 * @typedef {import('../lib/api').EvaluationResult} EvaluationResult
 * @typedef {import('../lib/api').Profile} Profile
 */

/**
 * @typedef {"start"|"home"|"lesson"|"loading"|"practice"|"evaluating"|"dashboard"|"leaderboard"|"about"|"writingCoach"} AppScreen
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
 * @property {Profile|null} profile - the signed-in child (from the server; nothing is kept in localStorage)
 * @property {"none"|"loading"|"ready"} profileStatus
 * @property {boolean} signedOut - this device was signed out while in use (e.g. unlinked by a parent)
 * @property {AppScreen|null} pendingScreen - where to go once a profile has been loaded
 * @property {Array} curriculum - units for the profile's grade (empty for grade 6)
 * @property {Record<string, {completed: boolean, bestScorePct: number}>} lessonStatus
 * @property {string|null} lessonId - set while a curriculum lesson session is active
 * @property {string|null} theoryLessonId - the lesson whose textbook pages are being read (screen "lesson")
 * @property {"idle"|"saving"|"saved"|"failed"} saveStatus
 */

/** Curriculum lessons always use a fixed-size question set. */
export const CURRICULUM_QUESTION_COUNT = 25

/** profiles.grade maps 1:1 onto the existing question-generation age groups. */
const GRADE_TO_AGE_GROUP = { 6: '9-10', 7: '11-12' }

/** The old email sign-in kept { profileId, email } here. It is no longer used. */
const OLD_PROFILE_STORAGE_KEY = 'mathBuddy.profile'

function forgetOldEmailSignIn() {
  try {
    window.localStorage.removeItem(OLD_PROFILE_STORAGE_KEY)
  } catch {
    // storage unavailable: nothing to forget
  }
}

const WRITING_COACH_OPEN_KEY = 'mathBuddy.wc.open'

/** Per-tab, so a refresh stays on Writing Coach but a new visit opens on home. */
function readWritingCoachOpen() {
  try {
    return window.sessionStorage.getItem(WRITING_COACH_OPEN_KEY) === '1'
  } catch {
    return false
  }
}

function writeWritingCoachOpen(open) {
  try {
    if (open) window.sessionStorage.setItem(WRITING_COACH_OPEN_KEY, '1')
    else window.sessionStorage.removeItem(WRITING_COACH_OPEN_KEY)
  } catch {
    // storage unavailable: a refresh just goes back to home
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
  signedOut: false,
  pendingScreen: null,
  curriculum: [],
  lessonStatus: {},
  lessonId: null,
  theoryLessonId: null,
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
  // 'loading' first: the server is asked whether this browser is a linked child device.
  // The screen is where a reload should land if it is (home, or Writing Coach if open).
  const [state, setState] = useState(() => ({
    ...INITIAL_STATE,
    profileStatus: 'loading',
    screen: readWritingCoachOpen() ? 'writingCoach' : 'home',
  }))

  useEffect(() => {
    writeWritingCoachOpen(state.screen === 'writingCoach')
  }, [state.screen])

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

  const refreshLessonStatus = useCallback(async () => {
    try {
      const lessonStatus = await fetchLessonStatus()
      setState((s) => ({ ...s, lessonStatus }))
    } catch (err) {
      console.warn('[refreshLessonStatus] failed', err)
    }
  }, [])

  /**
   * Make `profile` (the signed-in child) the active one: load its curriculum + lesson
   * status and set the age group from its grade. Throws if the curriculum can't load.
   */
  const enterProfile = useCallback(async (profile, { keepScreen = false } = {}) => {
    const [curriculum, lessonStatus] = await Promise.all([
      fetchCurriculum(profile.grade),
      fetchLessonStatus().catch((err) => {
        console.warn('[enterProfile] lesson status unavailable', err)
        return {}
      }),
    ])
    setState((s) => ({
      ...s,
      profile,
      profileStatus: 'ready',
      ageGroup: GRADE_TO_AGE_GROUP[profile.grade] ?? s.ageGroup,
      curriculum,
      lessonStatus,
      error: null,
      signedOut: false,
      screen: keepScreen ? s.screen : s.pendingScreen || 'home',
      pendingScreen: null,
    }))
  }, [])

  /** A child's device: use the one-time code from a parent, then enter that child's profile. */
  const linkWithCode = useCallback(async (code) => {
    const me = await linkDevice(code)
    await enterProfile(toProfile(me.profile))
  }, [enterProfile])

  // On start: ask the server who this browser is signed in as (refresh cookie).
  // A linked child: enter that child. A parent: the parent area. Nobody: the start screen.
  useEffect(() => {
    let cancelled = false
    forgetOldEmailSignIn()

    async function resume() {
      const me = await refreshSession().catch(() => null)
      if (cancelled) return
      if (me?.kind === 'parent') {
        openParentArea() // stays 'loading' until the page changes
        return
      }
      if (me?.kind !== 'child') {
        setState((s) => ({ ...s, profileStatus: 'none', screen: 'start' }))
        return
      }
      try {
        await enterProfile(toProfile(me.profile), { keepScreen: true })
      } catch (err) {
        if (cancelled) return
        console.error('[resumeLinkedChild] error:', err)
        setState((s) => ({
          ...s,
          profileStatus: 'none',
          error: {
            message: 'Could not load your profile. Please check your connection and try again.',
            retryFn: () => {
              setState((cur) => ({ ...cur, error: null, profileStatus: 'loading' }))
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

  // Signed out while in use (a parent unlinked this device, or it expired): back to the
  // start screen. Everything about the child is dropped from memory.
  useEffect(
    () =>
      onSignedOut(() => {
        setState((s) =>
          s.profile ? { ...INITIAL_STATE, profileStatus: 'none', screen: 'start', signedOut: true } : s
        )
      }),
    []
  )

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

  /**
   * Open a curriculum lesson: read its textbook pages first, then practise.
   * Lessons without reading pages go straight to practice.
   */
  const openLesson = useCallback((lessonId) => {
    const lesson = state.curriculum
      .flatMap((u) => u.lessons)
      .find((l) => l.id === lessonId)
    if (!lesson) return undefined
    if (!(lesson.theory_pages > 0)) return startLesson(lessonId)
    setState((s) => ({ ...s, screen: 'lesson', theoryLessonId: lessonId, error: null }))
    return undefined
  }, [state.curriculum, startLesson])

  /** Persist the finished session in the background; never blocks the child. */
  const persistAttempt = useCallback(async (result) => {
    if (!state.profile) return
    const payload = buildAttemptPayload({
      lessonId: state.lessonId,
      topicId: [...state.selectedTopics].sort().join('+') || 'adhoc',
      questions: state.questions,
      evaluationResult: result,
    })
    setState((s) => ({ ...s, saveStatus: 'saving' }))
    const saved = await saveAttemptWithRetry(payload)
    setState((s) => ({ ...s, saveStatus: saved ? 'saved' : 'failed' }))
    if (saved) refreshLessonStatus()
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
        ? { ...s, screen: 'start', pendingScreen: 'practice' }
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
    openLesson,
    submitAnswers,
    resetSession,
    goHome,
    navigateTo,
    enterProfile,
    linkWithCode,
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
