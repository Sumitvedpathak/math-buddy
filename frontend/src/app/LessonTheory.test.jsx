import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LessonTheory, { lessonPageUrl } from './LessonTheory'
import { SessionContext } from '../context/SessionContext'

const CURRICULUM = [
  {
    id: 'unit-02', number: 2, title: 'Ratio and Rate',
    lessons: [
      { id: '2.1', title: 'What Is a Ratio?', focus: 'Use models and diagrams to investigate ratios.', keywords: [], theory_pages: 3 },
    ],
  },
]

function renderLesson(stateOverrides = {}) {
  const ctx = {
    state: { curriculum: CURRICULUM, theoryLessonId: '2.1', ...stateOverrides },
    startLesson: vi.fn(),
    navigateTo: vi.fn(),
  }
  render(
    <SessionContext.Provider value={ctx}>
      <LessonTheory />
    </SessionContext.Provider>
  )
  return { ctx, user: userEvent.setup() }
}

const pageImage = () => screen.getByRole('img')

describe('LessonTheory', () => {
  it('shows the lesson title, its focus and the first textbook page', () => {
    renderLesson()
    expect(screen.getByRole('heading', { name: 'What Is a Ratio?' })).toBeInTheDocument()
    expect(screen.getByText(/investigate ratios/i)).toBeInTheDocument()
    expect(screen.getByText('Read page 1 of 3')).toBeInTheDocument()
    expect(pageImage()).toHaveAttribute('src', '/lessons/2.1/1.jpg')
    expect(pageImage()).toHaveAttribute('alt', 'What Is a Ratio? — lesson page 1 of 3')
  })

  it('builds page URLs under /lessons/<id>/<n>.jpg', () => {
    expect(lessonPageUrl('10.3', 2)).toBe('/lessons/10.3/2.jpg')
  })

  it('does not offer practice until the last page', () => {
    renderLesson()
    expect(screen.queryByRole('button', { name: /start practice/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
  })

  it('steps through the pages with Next and Back', async () => {
    const { user } = renderLesson()

    expect(screen.getByRole('button', { name: '← Back' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(pageImage()).toHaveAttribute('src', '/lessons/2.1/2.jpg')
    expect(screen.getByText('Read page 2 of 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '← Back' }))
    expect(pageImage()).toHaveAttribute('src', '/lessons/2.1/1.jpg')
  })

  it("ends with a \"Let's start practice\" button that starts the lesson's questions", async () => {
    const { ctx, user } = renderLesson()
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(pageImage()).toHaveAttribute('src', '/lessons/2.1/3.jpg')
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /let.s start practice/i }))
    expect(ctx.startLesson).toHaveBeenCalledWith('2.1')
  })

  it('still lets the child practise if a page image cannot be loaded', () => {
    const { ctx } = renderLesson()
    fireEvent.error(pageImage())

    expect(screen.getByRole('alert')).toHaveTextContent(/isn.t available/i)
    fireEvent.click(screen.getByRole('button', { name: /let.s start practice/i }))
    expect(ctx.startLesson).toHaveBeenCalledWith('2.1')
  })

  it('"Back to lessons" returns to the lesson list', async () => {
    const { ctx, user } = renderLesson()
    await user.click(screen.getByRole('button', { name: /back to lessons/i }))
    expect(ctx.navigateTo).toHaveBeenCalledWith('practice')
  })

  it('handles an unknown lesson without crashing', () => {
    renderLesson({ theoryLessonId: '99.9' })
    expect(screen.getByText(/couldn.t find that lesson/i)).toBeInTheDocument()
  })
})
