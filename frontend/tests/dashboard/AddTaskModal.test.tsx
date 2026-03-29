import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, makeMutationFn } from '../utils'
import AddTaskModal from '../../src/components/dashboard/AddTaskModal'

vi.mock('../../src/components/dashboard/TaskModal', () => ({
  default: ({
    isOpen,
    title,
    subtitle,
    primaryLabel,
    onSubmit,
    onClose,
  }: {
    isOpen?: boolean
    title: string
    subtitle: string
    primaryLabel: string
    onSubmit: (form: any) => Promise<void>
    onClose: () => void
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={`${title} dialog`}>
        <p>{subtitle}</p>
        <button
          onClick={() =>
            onSubmit({
              title: 'Task',
              description: 'Desc',
              taskType: 'Essay',
              dueDate: Date.now() + 86400000,
              classTag: '',
            })
          }
        >
          {primaryLabel}
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    ) : null,
}))

vi.mock('../../../backend/convex/_generated/api', () => ({
  api: { mutations: { tasks: { createTask: 'createTask' } } },
}))
vi.mock('convex/react', () => ({ useMutation: vi.fn() }))

import { useMutation } from 'convex/react'
const mockUseMutation = vi.mocked(useMutation)

describe('AddTaskModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseMutation.mockReturnValue(makeMutationFn() as never)
  })

  it('does not render when isOpen is false', () => {
    renderWithProviders(
      <AddTaskModal isOpen={false} onClose={vi.fn()} onTaskCreated={vi.fn()} />
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders with "Add task" title when open', () => {
    renderWithProviders(
      <AddTaskModal isOpen={true} onClose={vi.fn()} onTaskCreated={vi.fn()} />
    )
    expect(screen.getByRole('dialog', { name: /add task dialog/i })).toBeInTheDocument()
  })

  it('shows the subtitle "Fill in the details below."', () => {
    renderWithProviders(
      <AddTaskModal isOpen={true} onClose={vi.fn()} onTaskCreated={vi.fn()} />
    )
    expect(screen.getByText('Fill in the details below.')).toBeInTheDocument()
  })

  it('shows "Add Task" as the primary button label', () => {
    renderWithProviders(
      <AddTaskModal isOpen={true} onClose={vi.fn()} onTaskCreated={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: /add task/i })).toBeInTheDocument()
  })

  it('calls createTask mutation on submit', async () => {
    const user = userEvent.setup()
    const taskId = 'new-task-id'
    const createTaskMock = vi.fn().mockResolvedValue(taskId)
    mockUseMutation.mockReturnValue(createTaskMock as never)
    const onTaskCreated = vi.fn()
    renderWithProviders(
      <AddTaskModal isOpen={true} onClose={vi.fn()} onTaskCreated={onTaskCreated} />
    )
    await user.click(screen.getByRole('button', { name: /add task/i }))
    await waitFor(() => {
      expect(createTaskMock).toHaveBeenCalled()
    })
  })

  it('calls onTaskCreated with the taskId after submit', async () => {
    const user = userEvent.setup()
    const taskId = 'new-task-id'
    const createTaskMock = vi.fn().mockResolvedValue(taskId)
    mockUseMutation.mockReturnValue(createTaskMock as never)
    const onTaskCreated = vi.fn()
    renderWithProviders(
      <AddTaskModal isOpen={true} onClose={vi.fn()} onTaskCreated={onTaskCreated} />
    )
    await user.click(screen.getByRole('button', { name: /add task/i }))
    await waitFor(() => {
      expect(createTaskMock).toHaveBeenCalled()
      expect(onTaskCreated).toHaveBeenCalledWith(taskId)
    })
  })
})
