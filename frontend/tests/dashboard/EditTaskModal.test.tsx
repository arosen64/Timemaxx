import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../utils'
import EditModal from '../../src/components/dashboard/EditTaskModal'

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

const MOCK_TASK = {
  _id: 'task1' as any,
  title: 'Calculus Problem Set',
  description: 'Chapter 5 problems',
  taskType: 'Problem Set',
  timeEstimate: 90,
  dueDate: new Date('2026-04-01T23:59:00').getTime(),
  createdAt: Date.now(),
}

describe('EditTaskModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when task is null', () => {
    renderWithProviders(
      <EditModal isOpen={true} task={null} onClose={vi.fn()} onSave={vi.fn()} />
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does not render when isOpen is false', () => {
    renderWithProviders(
      <EditModal isOpen={false} task={MOCK_TASK} onClose={vi.fn()} onSave={vi.fn()} />
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders with "Edit task" title when open with a task', () => {
    renderWithProviders(
      <EditModal isOpen={true} task={MOCK_TASK} onClose={vi.fn()} onSave={vi.fn()} />
    )
    expect(screen.getByRole('dialog', { name: /edit task dialog/i })).toBeInTheDocument()
  })

  it('shows "Save Changes" as primary button label', () => {
    renderWithProviders(
      <EditModal isOpen={true} task={MOCK_TASK} onClose={vi.fn()} onSave={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })

  it('calls onSave when primary button clicked', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    renderWithProviders(
      <EditModal isOpen={true} task={MOCK_TASK} onClose={onClose} onSave={onSave} />
    )
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled()
    })
  })

  it('calls onSave and it resolves successfully', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    renderWithProviders(
      <EditModal isOpen={true} task={MOCK_TASK} onClose={onClose} onSave={onSave} />
    )
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled()
    })
  })
})
