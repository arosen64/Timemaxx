import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, makeMutationFn } from './utils'
import SyllabusReviewPage from '../src/pages/SyllabusReviewPage'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../backend/convex/_generated/api', () => ({
  api: {
    mutations: {
      syllabi: {
        confirmSyllabusTasks: 'confirmSyllabusTasks',
      },
    },
  },
}))

vi.mock('convex/react', () => ({
  useMutation: vi.fn(),
}))

vi.mock('../src/components/Sidebar', () => ({ default: () => <div data-testid="sidebar" /> }))

vi.mock('../src/components/syllabus/TaskReviewCard', () => ({
  default: ({
    task,
    onChange,
    onRemove,
  }: {
    task: { id: number; title: string }
    onChange: (t: unknown) => void
    onRemove: () => void
  }) => (
    <div data-testid={`task-card-${task.id}`}>
      <input
        aria-label="task-title"
        value={task.title}
        onChange={(e) => onChange({ ...task, title: e.target.value })}
      />
      <button onClick={onRemove}>Remove</button>
    </div>
  ),
}))

import { useMutation } from 'convex/react'
const mockUseMutation = vi.mocked(useMutation)

// ── Helpers ───────────────────────────────────────────────────────────────────

const TOMORROW_MS = Date.now() + 86_400_000

const MOCK_STATE = {
  syllabusId: 'syllabus1' as never,
  extractedTasks: [
    {
      title: 'Homework 1',
      description: 'First assignment',
      taskType: 'Problem Set',
      dueDate: TOMORROW_MS,
    },
    {
      title: 'Midterm',
      description: 'Mid-semester exam',
      taskType: 'Exam Prep',
      dueDate: TOMORROW_MS + 86_400_000,
    },
  ],
  course: { title: 'Algorithms', courseCode: 'EN.601.433', term: 'Spring 2026' },
}

function renderPage(state: typeof MOCK_STATE | null = MOCK_STATE) {
  return renderWithProviders(<SyllabusReviewPage />, {
    initialEntries: [{ pathname: '/syllabus-review', state }],
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SyllabusReviewPage', () => {
  beforeEach(() => {
    mockUseMutation.mockReturnValue(makeMutationFn())
  })

  describe('routing', () => {
    test('redirects to /classes when there is no location state', () => {
      renderPage(null)
      expect(screen.queryByText('Review Extracted Tasks')).not.toBeInTheDocument()
    })
  })

  describe('rendering', () => {
    test('renders page heading and sidebar', () => {
      renderPage()
      expect(screen.getByText('Review Extracted Tasks')).toBeInTheDocument()
      expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    })

    test('renders a card for each extracted task', () => {
      renderPage()
      expect(screen.getAllByTestId(/^task-card-/)).toHaveLength(2)
    })

    test('shows correct task count badge', () => {
      renderPage()
      expect(screen.getByText('2 tasks ready to confirm')).toBeInTheDocument()
    })

    test('shows singular "task" when only one task', () => {
      renderPage({
        ...MOCK_STATE,
        extractedTasks: [MOCK_STATE.extractedTasks[0]],
      })
      expect(screen.getByText('1 task ready to confirm')).toBeInTheDocument()
    })

    test('renders the course name in the description', () => {
      renderPage()
      expect(screen.getByText(/Algorithms/)).toBeInTheDocument()
    })

    test('renders Confirm Tasks button', () => {
      renderPage()
      expect(screen.getByRole('button', { name: /confirm tasks/i })).toBeInTheDocument()
    })

    test('renders Cancel button', () => {
      renderPage()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    test('Confirm Tasks button is disabled when task list is empty', () => {
      renderPage({ ...MOCK_STATE, extractedTasks: [] })
      expect(screen.getByRole('button', { name: /confirm tasks/i })).toBeDisabled()
    })
  })

  describe('adding tasks', () => {
    test('clicking "Add another task" appends a new card', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(screen.getByRole('button', { name: /add another task/i }))
      expect(screen.getAllByTestId(/^task-card-/)).toHaveLength(3)
      expect(screen.getByText('3 tasks ready to confirm')).toBeInTheDocument()
    })
  })

  describe('removing tasks', () => {
    test('clicking Remove on a card removes it from the list', async () => {
      const user = userEvent.setup()
      renderPage()
      const removeButtons = screen.getAllByRole('button', { name: /remove/i })
      await user.click(removeButtons[0])
      expect(screen.getAllByTestId(/^task-card-/)).toHaveLength(1)
      expect(screen.getByText('1 task ready to confirm')).toBeInTheDocument()
    })

    test('Confirm Tasks is disabled after all tasks are removed', async () => {
      const user = userEvent.setup()
      renderPage({ ...MOCK_STATE, extractedTasks: [MOCK_STATE.extractedTasks[0]] })
      await user.click(screen.getByRole('button', { name: /remove/i }))
      expect(screen.getByRole('button', { name: /confirm tasks/i })).toBeDisabled()
    })
  })

  describe('validation', () => {
    test('shows error when a task has no title', async () => {
      const user = userEvent.setup()
      renderPage({
        ...MOCK_STATE,
        extractedTasks: [{ ...MOCK_STATE.extractedTasks[0], title: '' }],
      })
      await user.click(screen.getByRole('button', { name: /confirm tasks/i }))
      expect(screen.getByText(/missing a title/i)).toBeInTheDocument()
    })
  })

  describe('confirmation', () => {
    test('calls confirmSyllabusTasks and navigates to /classes on success', async () => {
      const confirmMock = makeMutationFn()
      mockUseMutation.mockReturnValue(confirmMock)
      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getByRole('button', { name: /confirm tasks/i }))

      await waitFor(() => expect(confirmMock).toHaveBeenCalledOnce())
      expect(confirmMock).toHaveBeenCalledWith(
        expect.objectContaining({ syllabusId: 'syllabus1' })
      )
    })

    test('shows error message when confirmSyllabusTasks throws', async () => {
      const confirmMock = vi.fn().mockRejectedValue(new Error('Server error'))
      mockUseMutation.mockReturnValue(confirmMock)
      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getByRole('button', { name: /confirm tasks/i }))

      await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument())
    })

    test('shows "Confirming…" while mutation is in flight', async () => {
      let resolve!: () => void
      const confirmMock = vi.fn().mockReturnValue(new Promise<void>((r) => { resolve = r }))
      mockUseMutation.mockReturnValue(confirmMock)
      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getByRole('button', { name: /confirm tasks/i }))
      expect(await screen.findByRole('button', { name: /confirming/i })).toBeDisabled()

      resolve()
    })
  })
})
