import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TopicSelector from '../components/TopicSelector'
import { TOPICS } from '../lib/topics'

describe('TopicSelector', () => {
  it('renders all enabled topics', () => {
    const enabledTopics = TOPICS.filter((t) => t.enabled)
    render(<TopicSelector selected={[]} onToggle={() => {}} />)
    enabledTopics.forEach((topic) => {
      expect(screen.getByText(topic.displayName)).toBeInTheDocument()
    })
  })

  it('shows none pre-selected by default', () => {
    render(<TopicSelector selected={[]} onToggle={() => {}} />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => {
      expect(btn).not.toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('emits selection change when a topic is toggled', () => {
    const onToggle = vi.fn()
    render(<TopicSelector selected={[]} onToggle={onToggle} />)
    const firstTopic = TOPICS.filter((t) => t.enabled)[0]
    fireEvent.click(screen.getByText(firstTopic.displayName))
    expect(onToggle).toHaveBeenCalledWith(firstTopic.id)
  })

  it('marks selected topics as pressed', () => {
    const firstTopic = TOPICS.filter((t) => t.enabled)[0]
    render(<TopicSelector selected={[firstTopic.id]} onToggle={() => {}} />)
    const btn = screen.getByText(firstTopic.displayName).closest('button')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })
})
