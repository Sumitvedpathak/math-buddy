import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import { SessionProvider, useSession } from './SessionContext'
import * as api from '../lib/api'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api')
  return {
    ...actual,
    generateQuestions: vi.fn(),
    evaluateAnswers: vi.fn(),
    lookupProfile: vi.fn(),
    createProfile: vi.fn(),
    fetchCurriculum: vi.fn(),
    fetchLessonStatus: vi.fn(),
    saveAttemptWithRetry: vi.fn(),
  }
})

const PROFILE = { id: 'p1', email: 'kid@example.com', displayName: 'Sam', grade: '7' }
const CURRICULUM = [
  { id: 'unit-10', number: 10, title: 'Patterning and Algebra',
    lessons: [{ id: '10.3', title: 'Variables in Expressions', focus: 'f', keywords: ['variable'] }] },
]
const QUESTION = { id: 'q1', topic: 'Variables in Expressions', problem_type: 'lesson', text: '3n + 1', difficulty_tier: 1 }
const EVALUATION = {
  results: [{ questionId: 'q1', marks: 2, feedback: 'ok' }],
  totalScore: 2, maxScore: 2, topicBreakdown: {},
}
const ANSWERS = { q1: { questionId: 'q1', mode: 'text', content: '7' } }

let ctx
function Probe() {
  ctx = useSession()
  return null
}

function mount() {
  render(
    <SessionProvider>
      <Probe />
    </SessionProvider>
  )
}

beforeEach(() => {
  window.localStorage.clear()
  vi.clearAllMocks()
  api.fetchCurriculum.mockResolvedValue(CURRICULUM)
  api.fetchLessonStatus.mockResolvedValue({})
  api.generateQuestions.mockResolvedValue({ questions: [QUESTION], fun_facts: ['fact'] })
  api.evaluateAnswers.mockResolvedValue(EVALUATION)
  api.saveAttemptWithRetry.mockResolvedValue(true)
})

async function signIn() {
  mount()
  await act(() => ctx.enterProfile(PROFILE))
}

describe('profile bootstrap', () => {
  it('starts on the profile screen when nothing is cached', () => {
    mount()
    expect(ctx.state.screen).toBe('profile')
    expect(ctx.state.profile).toBeNull()
    expect(api.lookupProfile).not.toHaveBeenCalled()
  })

  it('auto-resumes a cached profile and derives the age group from its grade', async () => {
    window.localStorage.setItem('mathBuddy.profile', JSON.stringify({ profileId: 'p1', email: PROFILE.email }))
    api.lookupProfile.mockResolvedValue(PROFILE)
    mount()
    expect(ctx.state.profileStatus).toBe('loading')

    await waitFor(() => expect(ctx.state.profileStatus).toBe('ready'))
    expect(api.lookupProfile).toHaveBeenCalledWith(PROFILE.email)
    expect(ctx.state.profile).toEqual(PROFILE)
    expect(ctx.state.ageGroup).toBe('11-12')
    expect(ctx.state.curriculum).toEqual(CURRICULUM)
    expect(ctx.state.screen).toBe('home')
  })

  it('maps grade 6 to the 9-10 age group', async () => {
    mount()
    await act(() => ctx.enterProfile({ ...PROFILE, grade: '6' }))
    expect(ctx.state.ageGroup).toBe('9-10')
    expect(api.fetchCurriculum).toHaveBeenCalledWith('6')
  })

  it('drops a cached profile that no longer exists', async () => {
    window.localStorage.setItem('mathBuddy.profile', JSON.stringify({ profileId: 'p1', email: PROFILE.email }))
    api.lookupProfile.mockResolvedValue(null)
    mount()

    await waitFor(() => expect(ctx.state.screen).toBe('profile'))
    expect(ctx.state.profile).toBeNull()
    expect(window.localStorage.getItem('mathBuddy.profile')).toBeNull()
  })

  it('caches identity only (no progress data) after entering a profile', async () => {
    await signIn()
    expect(JSON.parse(window.localStorage.getItem('mathBuddy.profile'))).toEqual({
      profileId: 'p1', email: PROFILE.email,
    })
  })

  it('shows a retryable error when resuming fails', async () => {
    window.localStorage.setItem('mathBuddy.profile', JSON.stringify({ profileId: 'p1', email: PROFILE.email }))
    api.lookupProfile.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(PROFILE)
    mount()

    await waitFor(() => expect(ctx.state.error).not.toBeNull())
    expect(ctx.state.screen).toBe('profile')

    await act(async () => { ctx.state.error.retryFn() })
    await waitFor(() => expect(ctx.state.profile).toEqual(PROFILE))
    expect(ctx.state.error).toBeNull()
  })

  it('switchProfile forgets the cached identity', async () => {
    await signIn()
    act(() => ctx.switchProfile())
    expect(ctx.state.screen).toBe('profile')
    expect(ctx.state.profile).toBeNull()
    expect(window.localStorage.getItem('mathBuddy.profile')).toBeNull()
  })

  it('detours to the profile screen to practise, then continues to practice', async () => {
    mount()
    act(() => ctx.navigateTo('practice'))
    expect(ctx.state.screen).toBe('profile')

    await act(() => ctx.enterProfile(PROFILE))
    expect(ctx.state.screen).toBe('practice')
  })
})

describe('curriculum session', () => {
  it('startLesson generates a fixed 25-question lesson-scoped set', async () => {
    await signIn()
    await act(() => ctx.startLesson('10.3'))

    expect(api.generateQuestions).toHaveBeenCalledWith(
      ['Variables in Expressions'], '11-12', 25, '10.3'
    )
    expect(ctx.state.lessonId).toBe('10.3')
    expect(ctx.state.screen).toBe('practice')
    expect(ctx.state.questions).toEqual([QUESTION])
  })

  it('ignores an unknown lesson', async () => {
    await signIn()
    await act(() => ctx.startLesson('99.9'))
    expect(api.generateQuestions).not.toHaveBeenCalled()
  })

  it('a free-practice session after a lesson is not tagged with the lesson', async () => {
    await signIn()
    await act(() => ctx.startLesson('10.3'))
    act(() => ctx.resetSession())
    act(() => ctx.toggleTopic('algebra'))
    await act(() => ctx.startSession())

    expect(api.generateQuestions).toHaveBeenLastCalledWith(['algebra'], '11-12', 30, null)
    expect(ctx.state.lessonId).toBeNull()
  })

  it('saves a curriculum attempt after evaluation and refreshes lesson status', async () => {
    await signIn()
    await act(() => ctx.startLesson('10.3'))
    api.fetchLessonStatus.mockResolvedValue({ '10.3': { completed: true, bestScorePct: 100 } })

    await act(() => ctx.submitAnswers(ANSWERS))

    expect(ctx.state.screen).toBe('dashboard')
    expect(api.saveAttemptWithRetry).toHaveBeenCalledWith(expect.objectContaining({
      profile_id: 'p1', mode: 'curriculum', lesson_id: '10.3', topic_id: null, score: 2, max_score: 2,
    }))
    await waitFor(() => expect(ctx.state.saveStatus).toBe('saved'))
    await waitFor(() => expect(ctx.state.lessonStatus['10.3']?.completed).toBe(true))
  })

  it('saves a free-practice attempt as ad-hoc with the selected topics', async () => {
    await signIn()
    act(() => ctx.toggleTopic('volumes'))
    act(() => ctx.toggleTopic('algebra'))
    await act(() => ctx.startSession())
    await act(() => ctx.submitAnswers(ANSWERS))

    expect(api.saveAttemptWithRetry).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'adhoc', lesson_id: null, topic_id: 'algebra+volumes',
    }))
  })

  it('does not save anything without a profile', async () => {
    mount()
    act(() => ctx.toggleTopic('algebra'))
    await act(() => ctx.startSession())
    await act(() => ctx.submitAnswers(ANSWERS))

    expect(ctx.state.screen).toBe('dashboard')
    expect(api.saveAttemptWithRetry).not.toHaveBeenCalled()
  })

  it('a failed save never blocks the results screen', async () => {
    await signIn()
    await act(() => ctx.startLesson('10.3'))
    api.saveAttemptWithRetry.mockResolvedValue(false)

    await act(() => ctx.submitAnswers(ANSWERS))

    await waitFor(() => expect(ctx.state.saveStatus).toBe('failed'))
    expect(ctx.state.screen).toBe('dashboard')
    expect(ctx.state.evaluationResult).toEqual(EVALUATION)
    expect(ctx.state.error).toBeNull()
  })

  it('retrying a lesson generates a fresh set and clears the previous result', async () => {
    await signIn()
    await act(() => ctx.startLesson('10.3'))
    await act(() => ctx.submitAnswers(ANSWERS))
    api.generateQuestions.mockResolvedValue({
      questions: [{ ...QUESTION, id: 'q2', text: '5n - 2' }], fun_facts: ['fact'],
    })

    await act(() => ctx.startLesson('10.3'))

    expect(api.generateQuestions).toHaveBeenCalledTimes(2)
    expect(ctx.state.questions[0].id).toBe('q2')
    expect(ctx.state.evaluationResult).toBeNull()
    expect(ctx.state.answers).toEqual({})
  })

  it('resetSession keeps the profile and lesson progress', async () => {
    api.fetchLessonStatus.mockResolvedValue({ '10.3': { completed: true, bestScorePct: 100 } })
    await signIn()
    await act(() => ctx.startLesson('10.3'))
    act(() => ctx.resetSession())

    expect(ctx.state.profile).toEqual(PROFILE)
    expect(ctx.state.curriculum).toEqual(CURRICULUM)
    expect(ctx.state.lessonStatus['10.3'].completed).toBe(true)
    expect(ctx.state.lessonId).toBeNull()
    expect(ctx.state.screen).toBe('home')
  })

  it('a failed generation reports a retryable error', async () => {
    await signIn()
    api.generateQuestions.mockRejectedValueOnce(new Error('LLM down'))
    await act(() => ctx.startLesson('10.3'))

    expect(ctx.state.error.message).toMatch(/LLM down/)
    expect(ctx.state.lessonId).toBeNull()

    await act(async () => { await ctx.state.error.retryFn() })
    expect(api.generateQuestions).toHaveBeenLastCalledWith(
      ['Variables in Expressions'], '11-12', 25, '10.3'
    )
    expect(ctx.state.screen).toBe('practice')
  })
})
