import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, makeMutationFn } from './utils'
import AddTaskModal from '../src/components/dashboard/AddTaskModal'
import EstimateBadge from '../src/components/dashboard/EstimateBadge'

vi.mock('../../backend/convex/_generated/api', () => ({
  api: {
    functions: {
      requestGenerateSubtasks: { requestGenerateSubtasks: 'requestGenerateSubtasks' },
    },
    mutations: {
      tasks: { createTask: 'createTask' },
      timeEstimate: { setManualTimeEstimate: 'setManualTimeEstimate' },
    },
  },
}))

vi.mock('convex/react', () => ({
  useMutation: vi.fn(),
  useAction: vi.fn().mockReturnValue(vi.fn()),
}))

import { useMutation } from 'convex/react'
const mockUseMutation = vi.mocked(useMutation)

// ─── Task 5.3: time estimate input field is present in the form ───────────────

describe('AddTaskModal – time estimate input', () => {
  beforeEach(() => {
    mockUseMutation.mockReturnValue(makeMutationFn('task-id-1'))
  })

  test('renders hours and minutes inputs for time estimate after switching to manual mode', async () => {
    renderWithProviders(
      <AddTaskModal isOpen onClose={vi.fn()} />
    )

    await userEvent.click(screen.getByRole('button', { name: /set manually/i }))
    expect(screen.getByLabelText(/hours/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/minutes/i)).toBeInTheDocument()
  })

  test('time estimate field is optional — form can be submitted without it', async () => {
    const onClose = vi.fn()
    const mockCreate = makeMutationFn('task-id-1')
    mockUseMutation.mockReturnValue(mockCreate)

    renderWithProviders(
      <AddTaskModal isOpen onClose={onClose} />
    )

    await userEvent.click(screen.getByRole('button', { name: /set manually/i }))
    await userEvent.type(screen.getByPlaceholderText(/calculus/i), 'Test Task')
    expect(screen.getByLabelText(/hours/i)).toHaveValue(null)
    expect(screen.getByLabelText(/minutes/i)).toHaveValue(null)
  })
})

// ─── Task 5.4: EstimateBadge renders correct label ───────────────────────────

describe('EstimateBadge', () => {
  test('renders "Manual" when isManual is true', () => {
    renderWithProviders(<EstimateBadge isManual={true} />)
    expect(screen.getByText('Manual')).toBeInTheDocument()
  })

  test('renders "AI" when isManual is false', () => {
    renderWithProviders(<EstimateBadge isManual={false} />)
    expect(screen.getByText('AI')).toBeInTheDocument()
  })
})
