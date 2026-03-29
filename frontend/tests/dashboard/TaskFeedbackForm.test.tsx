import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../utils'
import TaskFeedbackForm from '../../src/components/dashboard/TaskFeedbackForm'

const DEFAULT_PROPS = {
  task: {
    estimateFeedbackRating: undefined as 'up' | 'down' | undefined,
    correctedEstimateMinutes: undefined as number | undefined,
  },
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

describe('TaskFeedbackForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows thumbs-up and thumbs-down rating buttons when no feedback submitted', () => {
    renderWithProviders(<TaskFeedbackForm {...DEFAULT_PROPS} />)
    expect(screen.getByRole('button', { name: 'Rate estimate thumbs up' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rate estimate thumbs down' })).toBeInTheDocument()
  })

  it('shows "Feedback: helpful" summary when rating is up and not editing', () => {
    const props = {
      ...DEFAULT_PROPS,
      task: { ...DEFAULT_PROPS.task, estimateFeedbackRating: 'up' as const },
    }
    renderWithProviders(<TaskFeedbackForm {...props} />)
    expect(screen.getByText(/Feedback: helpful/)).toBeInTheDocument()
  })

  it('shows "Feedback: improve" summary when rating is down and not editing', () => {
    const props = {
      ...DEFAULT_PROPS,
      task: { ...DEFAULT_PROPS.task, estimateFeedbackRating: 'down' as const },
    }
    renderWithProviders(<TaskFeedbackForm {...props} />)
    expect(screen.getByText(/Feedback: improve/)).toBeInTheDocument()
  })

  it('shows actual corrected time when correctedEstimateMinutes is set', () => {
    const props = {
      ...DEFAULT_PROPS,
      task: {
        estimateFeedbackRating: 'up' as const,
        correctedEstimateMinutes: 60,
      },
    }
    renderWithProviders(<TaskFeedbackForm {...props} />)
    expect(screen.getByText(/actual 1h 0m/)).toBeInTheDocument()
  })

  it('calls onStartEdit when the (edit) span button is clicked', async () => {
    const user = userEvent.setup()
    const props = {
      ...DEFAULT_PROPS,
      task: { ...DEFAULT_PROPS.task, estimateFeedbackRating: 'up' as const },
    }
    renderWithProviders(<TaskFeedbackForm {...props} />)
    await user.click(screen.getByText('edit', { selector: 'span' }))
    expect(DEFAULT_PROPS.onStartEdit).toHaveBeenCalledTimes(1)
  })

  it('shows rating form when isEditing is true even if estimateFeedbackRating is set', () => {
    const props = {
      ...DEFAULT_PROPS,
      task: { ...DEFAULT_PROPS.task, estimateFeedbackRating: 'up' as const },
      isEditing: true,
    }
    renderWithProviders(<TaskFeedbackForm {...props} />)
    expect(screen.getByRole('button', { name: 'Rate estimate thumbs up' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rate estimate thumbs down' })).toBeInTheDocument()
  })

  it('reveals hours and minutes inputs when draft.rating is set', () => {
    const props = {
      ...DEFAULT_PROPS,
      draft: { ...DEFAULT_PROPS.draft, rating: 'up' as const },
    }
    renderWithProviders(<TaskFeedbackForm {...props} />)
    expect(screen.getByPlaceholderText('hrs')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('mins')).toBeInTheDocument()
  })

  it('calls onToggleRating("up") when thumbs up is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TaskFeedbackForm {...DEFAULT_PROPS} />)
    await user.click(screen.getByRole('button', { name: 'Rate estimate thumbs up' }))
    expect(DEFAULT_PROPS.onToggleRating).toHaveBeenCalledWith('up')
  })

  it('calls onToggleRating("down") when thumbs down is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TaskFeedbackForm {...DEFAULT_PROPS} />)
    await user.click(screen.getByRole('button', { name: 'Rate estimate thumbs down' }))
    expect(DEFAULT_PROPS.onToggleRating).toHaveBeenCalledWith('down')
  })

  it('calls onHoursChange when hours input changes', async () => {
    const user = userEvent.setup()
    const props = {
      ...DEFAULT_PROPS,
      draft: { ...DEFAULT_PROPS.draft, rating: 'up' as const },
    }
    renderWithProviders(<TaskFeedbackForm {...props} />)
    await user.type(screen.getByPlaceholderText('hrs'), '2')
    expect(DEFAULT_PROPS.onHoursChange).toHaveBeenCalled()
  })

  it('calls onSubmit when Save button is clicked', async () => {
    const user = userEvent.setup()
    const props = {
      ...DEFAULT_PROPS,
      draft: { ...DEFAULT_PROPS.draft, rating: 'up' as const },
    }
    renderWithProviders(<TaskFeedbackForm {...props} />)
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    expect(DEFAULT_PROPS.onSubmit).toHaveBeenCalledTimes(1)
  })

  it('shows "Saving…" when isSubmitting is true', () => {
    const props = {
      ...DEFAULT_PROPS,
      draft: { ...DEFAULT_PROPS.draft, rating: 'up' as const },
      isSubmitting: true,
    }
    renderWithProviders(<TaskFeedbackForm {...props} />)
    expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument()
  })

  it('renders error message', () => {
    const props = { ...DEFAULT_PROPS, error: 'Something went wrong' }
    renderWithProviders(<TaskFeedbackForm {...props} />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })
})
