import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../utils'
import type React from 'react'
import TaskCard from '../../src/components/dashboard/TaskCard'

const MOCK_TASK = {
  _id: 'task1' as any,
  title: 'Calculus Problem Set',
  description: 'Chapter 5 problems',
  taskType: 'Problem Set',
  timeEstimate: 90,
  dueDate: new Date('2026-04-01T23:59:00').getTime(),
  createdAt: Date.now(),
}

const MOCK_BADGE = { bg: 'bg-red-100', text: 'text-red-700', label: 'Problem Set' }

const DEFAULT_FEEDBACK = {
  draft: { rating: undefined as 'up' | 'down' | undefined, hours: '', minutes: '' },
  error: undefined as string | undefined,
  isSubmitting: false,
  isEditing: false,
  onToggleRating: vi.fn(),
  onHoursChange: vi.fn(),
  onMinutesChange: vi.fn(),
  onSubmit: vi.fn(),
  onStartEdit: vi.fn(),
}

function setup(overrides: Partial<React.ComponentProps<typeof TaskCard>> = {}) {
  const props = {
    task: MOCK_TASK,
    barColor: 'bg-red-500',
    badge: MOCK_BADGE,
    isEstimating: false,
    feedback: DEFAULT_FEEDBACK,
    onEstimate: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  }
  renderWithProviders(<TaskCard {...props} />)
  return props
}

describe('TaskCard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders task title', () => {
    setup()
    expect(screen.getByText('Calculus Problem Set')).toBeInTheDocument()
  })

  it('renders task description', () => {
    setup()
    expect(screen.getByText('Chapter 5 problems')).toBeInTheDocument()
  })

  it('shows badge label', () => {
    setup()
    expect(screen.getByText('Problem Set')).toBeInTheDocument()
  })

  it('renders formatted time estimate "1h 30m"', () => {
    setup()
    expect(screen.getByText(/1h 30m/i)).toBeInTheDocument()
  })

  it('shows sparkle estimate button when timeEstimate is undefined', () => {
    setup({ task: { ...MOCK_TASK, timeEstimate: undefined } })
    expect(screen.getByRole('button', { name: 'Estimate task time' })).toBeInTheDocument()
  })

  it('hides sparkle estimate button when timeEstimate is defined', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Estimate task time' })).not.toBeInTheDocument()
  })

  it('shows spinner (no sparkle button) when isEstimating is true and timeEstimate is undefined', () => {
    setup({ task: { ...MOCK_TASK, timeEstimate: undefined }, isEstimating: true })
    expect(screen.queryByRole('button', { name: 'Estimate task time' })).not.toBeInTheDocument()
  })

  it('calls onEstimate when sparkle button clicked', async () => {
    const user = userEvent.setup()
    const props = setup({ task: { ...MOCK_TASK, timeEstimate: undefined } })
    await user.click(screen.getByRole('button', { name: 'Estimate task time' }))
    expect(props.onEstimate).toHaveBeenCalledTimes(1)
  })

  it('calls onEdit when edit button clicked', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.click(screen.getByRole('button', { name: 'Edit task' }))
    expect(props.onEdit).toHaveBeenCalledTimes(1)
  })

  it('calls onDelete when delete button clicked', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.click(screen.getByRole('button', { name: 'Delete task' }))
    expect(props.onDelete).toHaveBeenCalledTimes(1)
  })

  it('renders TaskFeedbackForm (thumbs-up button) when timeEstimate is defined', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Rate estimate thumbs up' })).toBeInTheDocument()
  })

  it('does not render TaskFeedbackForm when timeEstimate is undefined', () => {
    setup({ task: { ...MOCK_TASK, timeEstimate: undefined } })
    expect(screen.queryByRole('button', { name: 'Rate estimate thumbs up' })).not.toBeInTheDocument()
  })
})
