import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../utils'
import DeleteTaskModal from '../../src/components/dashboard/DeleteTaskModal'

const MOCK_TASK = {
  _id: 'task1' as any,
  title: 'Calculus Problem Set',
  description: '',
  taskType: 'Problem Set',
  dueDate: Date.now() + 86400000,
  createdAt: Date.now(),
}

const DEFAULT_PROPS = {
  isOpen: true,
  task: MOCK_TASK,
  onClose: vi.fn(),
  onConfirm: vi.fn().mockResolvedValue(undefined),
}

describe('DeleteTaskModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the task title in the confirmation message', () => {
    renderWithProviders(<DeleteTaskModal {...DEFAULT_PROPS} />)
    expect(screen.getByText(/"Calculus Problem Set"/)).toBeInTheDocument()
    expect(screen.getByText(/permanently deleted/i)).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    renderWithProviders(<DeleteTaskModal {...DEFAULT_PROPS} isOpen={false} />)
    expect(screen.queryByText(/permanently deleted/i)).toBeNull()
  })

  it('does not render when task is null', () => {
    renderWithProviders(<DeleteTaskModal {...DEFAULT_PROPS} task={null} />)
    expect(screen.queryByText(/permanently deleted/i)).toBeNull()
  })

  it('calls onConfirm when Delete button is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<DeleteTaskModal {...DEFAULT_PROPS} />)
    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(DEFAULT_PROPS.onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onClose after onConfirm resolves', async () => {
    const user = userEvent.setup()
    renderWithProviders(<DeleteTaskModal {...DEFAULT_PROPS} />)
    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(DEFAULT_PROPS.onClose).toHaveBeenCalledTimes(1)
  })

  it('shows "Deleting…" while deletion is in progress', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockReturnValue(new Promise<void>(() => {}))
    renderWithProviders(<DeleteTaskModal {...DEFAULT_PROPS} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(screen.getByRole('button', { name: /deleting/i })).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<DeleteTaskModal {...DEFAULT_PROPS} />)
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(DEFAULT_PROPS.onClose).toHaveBeenCalledTimes(1)
  })
})
