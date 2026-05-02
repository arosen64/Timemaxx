import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../utils'
import TaskModal from '../../src/components/dashboard/TaskModal'

vi.mock('../../../backend/convex/_generated/api', () => ({
  api: {
    actions: {
      requestGenerateSubtasks: { requestGenerateSubtasks: 'requestGenerateSubtasks' },
    },
  },
}))

vi.mock('convex/react', () => ({
  useAction: vi.fn().mockReturnValue(vi.fn()),
}))

function renderModal(overrides: Partial<Parameters<typeof TaskModal>[0]> = {}) {
  const props = {
    isOpen: true,
    title: 'Add task',
    subtitle: 'Fill in the details below.',
    primaryLabel: 'Add Task',
    primaryLoadingLabel: 'Adding…',
    initialValues: {
      taskName: '',
      selectedType: 'Essay',
      customTaskType: '',
      description: '',
      dueDate: '',
      dueTime: '23:59',
      classTag: '',
      timeEstimate: '',
    },
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  renderWithProviders(<TaskModal {...props} />)
  return props
}

describe('TaskModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders title and subtitle', () => {
    renderModal()
    expect(screen.getByText('Add task')).toBeInTheDocument()
    expect(screen.getByText('Fill in the details below.')).toBeInTheDocument()
  })

  it('shows all built-in task type buttons', () => {
    renderModal()
    for (const label of [
      'Essay',
      'Problem Set',
      'Exam Prep',
      'Coding',
      'Reading',
      'Lab',
      'Presentation',
      'Other',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('does not render when isOpen is false', () => {
    renderModal({ isOpen: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('hides assignment weight input when no course is associated', () => {
    renderModal()
    expect(screen.queryByLabelText(/grade weight/i)).toBeNull()
  })

  it('shows assignment weight input when a course is associated', () => {
    renderModal({
      classTagCourses: [
        {
          courseId: 'course1' as any,
          courseCode: 'AS.110.108',
          title: 'Calculus I',
          classTag: 'AS.110.108: Calculus I',
        },
      ],
      initialValues: {
        taskName: '',
        selectedType: 'Essay',
        customTaskType: '',
        description: '',
        dueDate: '',
        dueTime: '23:59',
        classTag: 'AS.110.108: Calculus I',
        timeEstimate: '',
      },
    })
    expect(screen.getByLabelText(/grade weight/i)).toBeInTheDocument()
  })

  it('shows validation error "Please enter a task name." when submitted with empty name', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: /add task/i }))
    expect(screen.getByText('Please enter a task name.')).toBeInTheDocument()
  })

  it('shows validation error "Please enter a description." when name is filled but description is empty', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.type(
      screen.getByPlaceholderText('e.g. Calculus Problem Set 5'),
      'My Task'
    )
    await user.click(screen.getByRole('button', { name: /add task/i }))
    expect(screen.getByText('Please enter a description.')).toBeInTheDocument()
  })

  it('shows validation error "Please pick a due date and time." when name and description filled but date empty', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.type(
      screen.getByPlaceholderText('e.g. Calculus Problem Set 5'),
      'My Task'
    )
    await user.type(
      screen.getByPlaceholderText('Paste or type your assignment description here...'),
      'Some description'
    )
    await user.click(screen.getByRole('button', { name: /add task/i }))
    expect(screen.getByText('Please pick a due date and time.')).toBeInTheDocument()
  })

  it('reveals custom type text input when "Other" is clicked', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole('button', { name: 'Other' }))
    expect(
      screen.getByPlaceholderText('Enter other task type')
    ).toBeInTheDocument()
  })

  async function pickFutureDate(user: ReturnType<typeof userEvent.setup>) {
    // Open the DatetimePicker (trigger is a button, not an input)
    await user.click(screen.getByRole('button', { name: /pick a due date/i }))
    // Click the first enabled day button (single/double digit number)
    const dayButtons = screen.getAllByRole('button').filter(
      (b) => /^\d{1,2}$/.test(b.textContent?.trim() ?? '') && !(b as HTMLButtonElement).disabled
    )
    await user.click(dayButtons[0])
    // Confirm selection
    await user.click(screen.getByRole('button', { name: /confirm/i }))
  }

  it('calls onSubmit with correct data on a fully valid form', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderModal()
    await user.type(
      screen.getByPlaceholderText('e.g. Calculus Problem Set 5'),
      'My Task'
    )
    await user.type(
      screen.getByPlaceholderText('Paste or type your assignment description here...'),
      'Some description'
    )
    await pickFutureDate(user)
    await user.click(screen.getByRole('button', { name: /add task/i }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My Task',
          description: 'Some description',
          taskType: 'Essay',
        })
      )
    })
  })

  it('shows an error when course assignment weights would exceed 100%', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    renderModal({
      onSubmit,
      classTagCourses: [
        {
          courseId: 'course1' as any,
          courseCode: 'AS.110.108',
          title: 'Calculus I',
          classTag: 'AS.110.108: Calculus I',
        },
      ],
      existingTasks: [
        {
          _id: 'task-existing-1' as any,
          title: 'Existing',
          description: 'Existing',
          taskType: 'Essay',
          isManualEstimate: false,
          dueDate: Date.now() + 86400000,
          createdAt: Date.now(),
          courseId: 'course1' as any,
          assignmentWeight: 80,
        },
      ],
      initialValues: {
        taskName: '',
        selectedType: 'Essay',
        customTaskType: '',
        description: '',
        dueDate: '',
        dueTime: '23:59',
        classTag: 'AS.110.108: Calculus I',
        timeEstimate: '',
        assignmentWeight: '',
      },
    })

    await user.type(
      screen.getByPlaceholderText('e.g. Calculus Problem Set 5'),
      'My Task'
    )
    await user.type(
      screen.getByPlaceholderText('Paste or type your assignment description here...'),
      'Some description'
    )
    await user.type(screen.getByLabelText(/grade weight/i), '30')
    await pickFutureDate(user)
    await user.click(screen.getByRole('button', { name: /add task/i }))

    expect(
      screen.getByText(
        'Assignments for this course already sum to 80%. Total course weight cannot exceed 100%.'
      )
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows loading label "Adding…" while submitting', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockReturnValue(new Promise<void>(() => {}))
    renderModal({ onSubmit })
    await user.type(
      screen.getByPlaceholderText('e.g. Calculus Problem Set 5'),
      'My Task'
    )
    await user.type(
      screen.getByPlaceholderText('Paste or type your assignment description here...'),
      'Some description'
    )
    await pickFutureDate(user)
    await user.click(screen.getByRole('button', { name: /add task/i }))
    await waitFor(() => {
      expect(screen.getByText('Adding…')).toBeInTheDocument()
    })
  })

  it('pre-populates fields from initialValues', () => {
    renderModal({
      initialValues: {
        taskName: 'Existing Task',
        selectedType: 'Essay',
        customTaskType: '',
        description: '',
        dueDate: '',
        dueTime: '23:59',
        classTag: '',
        timeEstimate: '',
      },
    })
    expect(screen.getByDisplayValue('Existing Task')).toBeInTheDocument()
  })
})
