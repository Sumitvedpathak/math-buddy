import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminApp, { adminTokenFromPath } from './AdminApp'
import { adminGet } from '../../lib/api'

vi.mock('../../lib/api', () => ({ adminGet: vi.fn() }))

const PROFILES = [
  { id: 'p1', email: 'sam@example.com', display_name: 'Sam', grade: '7', created_at: '2026-10-01T00:00:00Z',
    attempt_count: 3, last_attempt_at: '2026-10-20T12:00:00Z' },
]

const today = new Date().toISOString().slice(0, 10)
const DAILY = [{
  date: today, attempt_count: 3, curriculum_attempts: 2, adhoc_attempts: 1, avg_score_pct: 75.33, best_score_pct: 96,
}]
const ATTEMPTS = [{
  id: 'a1', mode: 'curriculum', lesson_id: '10.3', topic_id: null, question_count: 25,
  score: 48, max_score: 50, score_pct: 96, created_at: '2026-10-20T12:00:00Z',
}]
const LESSONS = [
  { lesson_id: '2.1', lesson_title: 'What Is a Ratio?', unit_id: 'unit-02', unit_title: 'Ratio and Rate',
    completed: true, best_score_pct: 96, attempts_count: 2, last_attempt_at: '2026-10-20T12:00:00Z' },
  { lesson_id: '2.2', lesson_title: 'Equivalent Ratios', unit_id: 'unit-02', unit_title: 'Ratio and Rate',
    completed: false, best_score_pct: 0, attempts_count: 0, last_attempt_at: null },
]

beforeEach(() => {
  vi.clearAllMocks()
  adminGet.mockImplementation(async (_token, path) => {
    if (path === '/profiles') return PROFILES
    if (path.endsWith('/progress/daily')) return DAILY
    if (path.endsWith('/attempts')) return ATTEMPTS
    if (path.endsWith('/lesson-progress')) return LESSONS
    throw new Error(`unexpected ${path}`)
  })
})

describe('adminTokenFromPath', () => {
  it('extracts the token from /admin/<token>', () => {
    expect(adminTokenFromPath('/admin/abc123')).toBe('abc123')
    expect(adminTokenFromPath('/admin/abc123/')).toBe('abc123')
  })

  it('ignores every other path', () => {
    expect(adminTokenFromPath('/')).toBeNull()
    expect(adminTokenFromPath('/admin')).toBeNull()
    expect(adminTokenFromPath('/admin/')).toBeNull()
    expect(adminTokenFromPath('/admin/a/b')).toBeNull()
    expect(adminTokenFromPath('/practice')).toBeNull()
  })
})

describe('AdminApp', () => {
  it('shows a generic not-found page for a wrong token', async () => {
    adminGet.mockRejectedValue(Object.assign(new Error('API error 404'), { status: 404 }))
    render(<AdminApp token="wrong" />)

    expect(await screen.findByText(/page not found/i)).toBeInTheDocument()
    expect(screen.queryByText(/parent dashboard/i)).not.toBeInTheDocument()
  })

  it('sends the token with every admin request', async () => {
    render(<AdminApp token="secret-token" />)
    await screen.findByText('Sam')
    expect(adminGet).toHaveBeenCalledWith('secret-token', '/profiles')
  })

  it('lists children and loads the three views for the selected child', async () => {
    const user = userEvent.setup()
    render(<AdminApp token="t" />)

    await user.click(await screen.findByRole('button', { name: /sam/i }))

    const daily = await screen.findByRole('heading', { name: /sam — daily progress/i })
    expect(daily).toBeInTheDocument()
    expect(adminGet).toHaveBeenCalledWith('t', '/profiles/p1/progress/daily')
    expect(adminGet).toHaveBeenCalledWith('t', '/profiles/p1/attempts')
    expect(adminGet).toHaveBeenCalledWith('t', '/profiles/p1/lesson-progress')

    // daily table row
    await waitFor(() => expect(screen.getByText('75.33%')).toBeInTheDocument())
    // calendar grid
    expect(screen.getByRole('img', { name: /practice activity/i })).toBeInTheDocument()
    // lesson mastery grid
    expect(screen.getByText('1 of 2 lessons mastered.')).toBeInTheDocument()
    expect(screen.getByText(/not started/i)).toBeInTheDocument()
    // attempt history
    const history = screen.getByRole('heading', { name: /attempt history/i }).closest('section')
    expect(within(history).getByText('Lesson')).toBeInTheDocument()
    expect(within(history).getByText('48 / 50')).toBeInTheDocument()
    expect(within(history).getByText('96%')).toBeInTheDocument()
  })

  it('shows an empty state when no children exist', async () => {
    adminGet.mockResolvedValue([])
    render(<AdminApp token="t" />)
    expect(await screen.findByText(/no children have signed up/i)).toBeInTheDocument()
  })
})
