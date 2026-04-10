import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, makeMutationFn } from '../utils'
import DashboardPage from '../../src/pages/DashboardPage'

vi.mock('../../../backend/convex/_generated/api', () => ({
  api: {
    queries: {
      users: { getCurrUser: 'getCurrUser' },
      tasks: { getAllTasks: 'getAllTasks' },
      studyBlocks: { getUpcomingStudyBlocks: 'getUpcomingStudyBlocks', getStudyBlocksByTask: 'getStudyBlocksByTask' },
      userCourses: { getUserCourses: 'getUserCourses' },
    },
    mutations: {
      tasks: { updateTask: 'updateTask', deleteTask: 'deleteTask' },
      timeEstimate: { submitEstimateFeedback: 'submitEstimateFeedback' },
    },
    ai: {
      requestEstimateTaskTime: { requestEstimateTaskTime: 'requestEstimateTaskTime' },
    },
  },
}))

// Sidebar is out of scope for dashboard behavioral tests
vi.mock('../../src/components/Sidebar', () => ({ default: () => <div data-testid="sidebar" /> }))

// AddTaskModal is tested separately; mock it here so dashboard tests stay focused
vi.mock('../../src/components/dashboard/AddTaskModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div role="dialog" aria-label="Add Task Modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}))

vi.mock('../../src/components/dashboard/EditTaskModal', () => ({
  default: ({
    isOpen,
    task,
    onClose,
  }: {
    isOpen: boolean
    task: { title: string } | null
    onClose: () => void
  }) =>
    isOpen && task ? (
      <div role="dialog" aria-label="Edit Task Modal">
        <span data-testid="editing-task-title">{task.title}</span>
        <button onClick={onClose}>Close Edit Modal</button>
      </div>
    ) : null,
}))

vi.mock('../../src/components/dashboard/DeleteTaskModal', () => ({
  default: ({
    isOpen,
    task,
    onClose,
    onConfirm,
  }: {
    isOpen: boolean
    task: { title: string } | null
    onClose: () => void
    onConfirm: () => Promise<void>
  }) =>
    isOpen && task ? (
      <div role="dialog" aria-label="Delete Task Modal">
        <span data-testid="deleting-task-title">{task.title}</span>
        <button onClick={onConfirm}>Confirm Delete</button>
        <button onClick={onClose}>Cancel Delete</button>
      </div>
    ) : null,
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useAction: vi.fn(),
}))

import { useQuery, useMutation, useAction } from 'convex/react'

const mockUseQuery = vi.mocked(useQuery)
const mockUseMutation = vi.mocked(useMutation)
const mockUseAction = vi.mocked(useAction)

const MOCK_USER = { name: 'Anna Mintzer', onboardingComplete: true }

const MOCK_TASKS = [
  {
    _id: 'task1',
    title: 'Calculus Problem Set',
    description: 'Chapter 5 problems',
    taskType: 'Problem Set',
    timeEstimate: 90,
    dueDate: Date.now() + 86400000,
    createdAt: Date.now(),
  },
  {
    _id: 'task2',
    title: 'Biology Lab Report',
    description: 'Write about cell division',
    taskType: 'Essay',
    timeEstimate: undefined,
    dueDate: Date.now() + 172800000,
    createdAt: Date.now(),
  },
]

// task1 with feedback already submitted — used to test the saved-feedback "edit" flow
const TASK_WITH_FEEDBACK = {
  ...MOCK_TASKS[0],
  estimateFeedbackRating: 'up' as const,
  correctedEstimateMinutes: 60,
}

function setup(tasks = MOCK_TASKS, user = MOCK_USER) {
  mockUseQuery.mockImplementation(((query: string) => {
    if (query === 'getAllTasks') return tasks
    if (query === 'getUpcomingStudyBlocks') return []
    if (query === 'getUserCourses') return []
    if (query === 'getStudyBlocksByTask') return []
    return user
  }) as never)
  mockUseMutation.mockReturnValue(makeMutationFn() as never)
  mockUseAction.mockReturnValue(makeMutationFn() as never)
  renderWithProviders(<DashboardPage />)
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when there are no tasks', () => {
    setup([])
    expect(screen.getByText('No tasks yet')).toBeInTheDocument()
    expect(screen.getByText(/add your first task/i)).toBeInTheDocument()
  })

  it('renders task list with task titles', () => {
    setup()
    expect(screen.getByText('Calculus Problem Set')).toBeInTheDocument()
    expect(screen.getByText('Biology Lab Report')).toBeInTheDocument()
  })

  it('displays time estimate in hours and minutes for tasks that have one', () => {
    setup()
    expect(screen.getAllByText(/1h 30m/i).length).toBeGreaterThan(0)
  })

  it('shows loading state when tasks are undefined', () => {
    mockUseQuery.mockImplementation(((query: string) => {
      if (query === 'getAllTasks') return undefined
      if (query === 'getUpcomingStudyBlocks') return []
      if (query === 'getStudyBlocksByTask') return []
      return MOCK_USER
    }) as never)
    mockUseMutation.mockReturnValue(makeMutationFn() as never)
    mockUseAction.mockReturnValue(makeMutationFn() as never)
    renderWithProviders(<DashboardPage />)

    expect(screen.getByText('Loading tasks…')).toBeInTheDocument()
  })

  it('opens Add Task modal when Add Task button is clicked', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: /add task/i }))

    expect(screen.getByRole('dialog', { name: /add task modal/i })).toBeInTheDocument()
  })

  it('closes Add Task modal when modal close is triggered', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: /add task/i }))
    await user.click(screen.getByRole('button', { name: /close modal/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows estimation error modal when requestEstimate throws a JSON error', async () => {
    const user = userEvent.setup()
    const estimateAction = vi.fn().mockRejectedValue(
      new Error('ConvexError: {"error":{"code":429,"message":"Rate limit exceeded"}}')
    )

    const tasksWithoutEstimate = MOCK_TASKS.map((t) => ({ ...t, timeEstimate: undefined }))
    mockUseQuery.mockImplementation(((query: string) => {
      if (query === 'getAllTasks') return tasksWithoutEstimate
      if (query === 'getUpcomingStudyBlocks') return []
      if (query === 'getStudyBlocksByTask') return []
      return MOCK_USER
    }) as never)
    mockUseMutation.mockReturnValue(makeMutationFn() as never)
    mockUseAction.mockReturnValue(estimateAction as never)
    renderWithProviders(<DashboardPage />)

    // Click the sparkle estimate button for the first task
    const estimateButtons = screen.getAllByRole('button', { name: /estimate task time/i })
    await user.click(estimateButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Estimation Failed')).toBeInTheDocument()
      expect(screen.getByText('Error 429: Rate limit exceeded')).toBeInTheDocument()
    })
  })

  it('dismisses estimation error modal when Dismiss is clicked', async () => {
    const user = userEvent.setup()
    const estimateAction = vi.fn().mockRejectedValue(
      new Error('ConvexError: {"error":{"code":500,"message":"Internal error"}}')
    )

    const tasksWithoutEstimate = MOCK_TASKS.map((t) => ({ ...t, timeEstimate: undefined }))
    mockUseQuery.mockImplementation(((query: string) => {
      if (query === 'getAllTasks') return tasksWithoutEstimate
      if (query === 'getUpcomingStudyBlocks') return []
      if (query === 'getStudyBlocksByTask') return []
      return MOCK_USER
    }) as never)
    mockUseMutation.mockReturnValue(makeMutationFn() as never)
    mockUseAction.mockReturnValue(estimateAction as never)
    renderWithProviders(<DashboardPage />)

    const estimateButtons = screen.getAllByRole('button', { name: /estimate task time/i })
    await user.click(estimateButtons[0])

    await waitFor(() => expect(screen.getByText('Estimation Failed')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(screen.queryByText('Estimation Failed')).not.toBeInTheDocument()
  })

  it('shows fallback message for non-JSON estimation errors', async () => {
    const user = userEvent.setup()
    const estimateAction = vi.fn().mockRejectedValue(new Error('Network error'))

    const tasksWithoutEstimate = MOCK_TASKS.map((t) => ({ ...t, timeEstimate: undefined }))
    mockUseQuery.mockImplementation(((query: string) => {
      if (query === 'getAllTasks') return tasksWithoutEstimate
      if (query === 'getUpcomingStudyBlocks') return []
      if (query === 'getStudyBlocksByTask') return []
      return MOCK_USER
    }) as never)
    mockUseMutation.mockReturnValue(makeMutationFn() as never)
    mockUseAction.mockReturnValue(estimateAction as never)
    renderWithProviders(<DashboardPage />)

    const estimateButtons = screen.getAllByRole('button', { name: /estimate task time/i })
    await user.click(estimateButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Failed to estimate task time. Please try again.')).toBeInTheDocument()
    })
  })

  // ── Greeting & header ────────────────────────────────────────────────────────

  it('renders the user first name in the greeting', () => {
    setup()
    expect(screen.getByText(/good (morning|afternoon|evening), Anna!/i)).toBeInTheDocument()
  })

  it('shows plural task count in subtitle', () => {
    setup()
    expect(screen.getByText(/2 tasks due this week/)).toBeInTheDocument()
  })

  it('shows singular task in subtitle when there is exactly one task', () => {
    setup([MOCK_TASKS[0]])
    expect(screen.getByText(/1 task due this week/)).toBeInTheDocument()
  })

  // ── Stat cards ───────────────────────────────────────────────────────────────

  it('Tasks This Week stat card shows the task count', () => {
    setup()
    expect(screen.getByText('Tasks This Week')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('Estimated Time stat card shows the formatted total of estimated minutes', () => {
    setup()
    // task1 has 90 min, task2 has undefined → total 90 min → "1h 30m"
    expect(screen.getByText('1h 30m')).toBeInTheDocument()
  })

  // ── Edit task flow ───────────────────────────────────────────────────────────

  it('opens Edit modal with the correct task when edit button is clicked', async () => {
    const user = userEvent.setup()
    setup()

    const editButtons = screen.getAllByRole('button', { name: /edit task/i })
    await user.click(editButtons[0])

    expect(screen.getByRole('dialog', { name: /edit task modal/i })).toBeInTheDocument()
    expect(screen.getByTestId('editing-task-title')).toHaveTextContent('Calculus Problem Set')
  })

  it('closes Edit modal when close is triggered', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getAllByRole('button', { name: /edit task/i })[0])
    await user.click(screen.getByRole('button', { name: /close edit modal/i }))

    expect(screen.queryByRole('dialog', { name: /edit task modal/i })).not.toBeInTheDocument()
  })

  // ── Delete task flow ─────────────────────────────────────────────────────────

  it('opens Delete modal with the correct task when delete button is clicked', async () => {
    const user = userEvent.setup()
    setup()

    const deleteButtons = screen.getAllByRole('button', { name: /delete task/i })
    await user.click(deleteButtons[0])

    expect(screen.getByRole('dialog', { name: /delete task modal/i })).toBeInTheDocument()
    expect(screen.getByTestId('deleting-task-title')).toHaveTextContent('Calculus Problem Set')
  })

  it('closes Delete modal on cancel', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getAllByRole('button', { name: /delete task/i })[0])
    await user.click(screen.getByRole('button', { name: /cancel delete/i }))

    expect(screen.queryByRole('dialog', { name: /delete task modal/i })).not.toBeInTheDocument()
  })

  it('calls deleteTask mutation when delete is confirmed', async () => {
    const user = userEvent.setup()
    const deleteTaskMock = vi.fn().mockResolvedValue(undefined)

    mockUseQuery.mockImplementation(((query: string) => {
      if (query === 'getAllTasks') return MOCK_TASKS
      if (query === 'getUpcomingStudyBlocks') return []
      if (query === 'getStudyBlocksByTask') return []
      return MOCK_USER
    }) as never)
    mockUseMutation.mockImplementation(((mutation: string) => {
      if (mutation === 'deleteTask') return deleteTaskMock as never
      return makeMutationFn() as never
    }) as never)
    mockUseAction.mockReturnValue(makeMutationFn() as never)
    renderWithProviders(<DashboardPage />)

    await user.click(screen.getAllByRole('button', { name: /delete task/i })[0])
    await user.click(screen.getByRole('button', { name: /confirm delete/i }))

    await waitFor(() => {
      expect(deleteTaskMock).toHaveBeenCalledWith({ taskId: 'task1' })
    })
  })

  // ── Feedback flow ────────────────────────────────────────────────────────────

  it('shows time inputs after a thumbs-up rating is selected', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: /rate estimate thumbs up/i }))

    expect(screen.getByPlaceholderText('hrs')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('mins')).toBeInTheDocument()
  })

  it('shows time inputs after a thumbs-down rating is selected', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: /rate estimate thumbs down/i }))

    expect(screen.getByPlaceholderText('hrs')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('mins')).toBeInTheDocument()
  })

  it('calls submitEstimateFeedback with the rating on submit', async () => {
    const user = userEvent.setup()
    const submitFeedbackMock = vi.fn().mockResolvedValue(undefined)

    mockUseQuery.mockImplementation(((query: string) => {
      if (query === 'getAllTasks') return MOCK_TASKS
      if (query === 'getUpcomingStudyBlocks') return []
      if (query === 'getStudyBlocksByTask') return []
      return MOCK_USER
    }) as never)
    mockUseMutation.mockImplementation(((mutation: string) => {
      if (mutation === 'submitEstimateFeedback') return submitFeedbackMock as never
      return makeMutationFn() as never
    }) as never)
    mockUseAction.mockReturnValue(makeMutationFn() as never)
    renderWithProviders(<DashboardPage />)

    await user.click(screen.getByRole('button', { name: /rate estimate thumbs up/i }))
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(submitFeedbackMock).toHaveBeenCalledWith({
        taskId: 'task1',
        feedback: { rating: 'up', correctedEstimateMinutes: undefined },
      })
    })
  })

  it('re-enters the rating form when edit is clicked on saved feedback', async () => {
    const user = userEvent.setup()
    setup([TASK_WITH_FEEDBACK, MOCK_TASKS[1]])

    // Saved feedback summary is shown
    expect(screen.getByText(/feedback: helpful/i)).toBeInTheDocument()

    // Click the inline "(edit)" button to re-enter the form
    // The button has no aria-label; its text content is "(<span>edit</span>)" so query via the inner span
    await user.click(screen.getByText('edit', { selector: 'span' }))

    // Rating buttons are visible again
    expect(screen.getByRole('button', { name: /rate estimate thumbs up/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /rate estimate thumbs down/i })).toBeInTheDocument()
  })
})
