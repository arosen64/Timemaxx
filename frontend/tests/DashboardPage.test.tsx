import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, makeMutationFn } from './utils'
import DashboardPage from '../src/pages/DashboardPage'

vi.mock('../../backend/convex/_generated/api', () => ({
  api: {
    queries: {
      users: { getCurrUser: 'getCurrUser' },
      tasks: { getAllTasks: 'getAllTasks' },
    },
    mutations: {
      tasks: { updateTask: 'updateTask', deleteTask: 'deleteTask' },
    },
    actions: {
      requestEstimateTaskTime: { requestEstimateTaskTime: 'requestEstimateTaskTime' },
    },
  },
}))

// Sidebar is out of scope for dashboard behavioral tests
vi.mock('../src/components/sidebar', () => ({ default: () => <div data-testid="sidebar" /> }))

// AddTaskModal is tested separately; mock it here so dashboard tests stay focused
vi.mock('../src/components/dashboard/AddTaskModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div role="dialog" aria-label="Add Task Modal">
        <button onClick={onClose}>Close Modal</button>
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

function setup(tasks = MOCK_TASKS, user = MOCK_USER) {
  mockUseQuery.mockImplementation((query) => {
    if (query === 'getAllTasks') return tasks
    return user
  })
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

  it('displays time estimate in minutes for tasks that have one', () => {
    setup()
    expect(screen.getByText(/90 mins estimated/i)).toBeInTheDocument()
  })

  it('shows loading state when tasks are undefined', () => {
    mockUseQuery.mockImplementation((query) => {
      if (query === 'getAllTasks') return undefined
      return MOCK_USER
    })
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
    mockUseQuery.mockImplementation((query: string) => {
      if (query === 'getAllTasks') return tasksWithoutEstimate
      return MOCK_USER
    })
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
    mockUseQuery.mockImplementation((query: string) => {
      if (query === 'getAllTasks') return tasksWithoutEstimate
      return MOCK_USER
    })
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
    mockUseQuery.mockImplementation((query: string) => {
      if (query === 'getAllTasks') return tasksWithoutEstimate
      return MOCK_USER
    })
    mockUseMutation.mockReturnValue(makeMutationFn() as never)
    mockUseAction.mockReturnValue(estimateAction as never)
    renderWithProviders(<DashboardPage />)

    const estimateButtons = screen.getAllByRole('button', { name: /estimate task time/i })
    await user.click(estimateButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Failed to estimate task time. Please try again.')).toBeInTheDocument()
    })
  })
})
