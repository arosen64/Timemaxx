import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, makeMutationFn } from './utils'
import ClassesPage from '../src/pages/ClassesPage'
import type { Course } from '../src/types'

vi.mock('../../backend/convex/_generated/api', () => ({
  api: {
    queries: {
      userCourses: {
        getUserCourses: 'getUserCourses',
        getCourseMetadata: 'getCourseMetadata',
      },
    },
    mutations: {
      userCourses: {
        deleteUserCourse: 'deleteUserCourse',
      },
    },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

vi.mock('../src/components/Sidebar', () => ({ default: () => <div data-testid="sidebar" /> }))
vi.mock('../src/components/classes/ClassCard', () => ({
  default: () => <div data-testid="class-card" />,
}))
vi.mock('../src/components/CourseSelector', () => ({
  default: ({ onAddCourse }: { onAddCourse: () => void }) => (
    <div data-testid="course-selector">
      <button onClick={onAddCourse}>Done</button>
    </div>
  ),
}))

let capturedOnCoursesAdded: (courses: Course[]) => void = () => {}
vi.mock('../src/components/TranscriptUpload', () => ({
  default: ({ onCoursesAdded }: { onCoursesAdded: (courses: Course[]) => void }) => {
    capturedOnCoursesAdded = onCoursesAdded
    return <div data-testid="transcript-upload" />
  },
}))

import { useQuery, useMutation } from 'convex/react'
import { api } from '../../backend/convex/_generated/api'

const mockUseQuery = vi.mocked(useQuery)
const mockUseMutation = vi.mocked(useMutation)

const MOCK_CURRENT_COURSE = {
  _id: 'course1',
  courseCode: 'EN.601.421',
  title: 'Object-Oriented Software Engineering',
  term: 'Spring 2026',
  grade: undefined,
}

const MOCK_PAST_COURSE = {
  _id: 'course2',
  courseCode: 'EN.601.226',
  title: 'Data Structures',
  term: 'Fall 2024',
  grade: 'A',
}

const MOCK_METADATA = [
  { courseId: 'course1', hasSyllabus: false, taskCount: 0 },
  { courseId: 'course2', hasSyllabus: true, taskCount: 3 },
]

function makeQueryImpl(courses: unknown[], metadata: unknown[] = MOCK_METADATA) {
  return (...args: Parameters<typeof useQuery>) => {
    if (args[0] === api.queries.userCourses.getUserCourses) return courses as never
    if (args[0] === api.queries.userCourses.getCourseMetadata) return metadata as never
    return undefined as never
  }
}

function setup(courses = [MOCK_CURRENT_COURSE, MOCK_PAST_COURSE]) {
  mockUseQuery.mockImplementation(makeQueryImpl(courses))
  mockUseMutation.mockReturnValue(makeMutationFn() as never)
  renderWithProviders(<ClassesPage />, { initialEntries: ['/classes'] })
}

function setupLoading() {
  mockUseQuery.mockReturnValue(undefined as never)
  mockUseMutation.mockReturnValue(makeMutationFn() as never)
  renderWithProviders(<ClassesPage />, { initialEntries: ['/classes'] })
}

describe('ClassesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedOnCoursesAdded = () => {}
  })

  // ── Page structure ───────────────────────────────────────────────────────

  it('renders page heading and sidebar', () => {
    setup()
    expect(screen.getByText('Classes')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
  })

  it('shows loading skeletons while data is pending', () => {
    setupLoading()
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
    expect(screen.queryByTestId('class-card')).not.toBeInTheDocument()
  })

  it('renders course cards when data loads', () => {
    setup()
    // Default tab is "current" — only the current course is shown
    expect(screen.getAllByTestId('class-card')).toHaveLength(1)
  })

  // ── Tabs ─────────────────────────────────────────────────────────────────

  it('defaults to the current tab', () => {
    setup()
    const currentTab = screen.getByRole('button', { name: /current/i })
    expect(currentTab.className).toMatch(/border-navy/)
  })

  it('clicking the past tab shows past courses', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: /past/i }))
    expect(screen.getAllByTestId('class-card')).toHaveLength(1)
  })

  it('shows empty state when there are no current courses', () => {
    setup([MOCK_PAST_COURSE])
    expect(screen.getByText('No current classes')).toBeInTheDocument()
  })

  // ── Import Transcript button ──────────────────────────────────────────────

  it('Import Transcript button is always visible in the header', () => {
    setup()
    expect(screen.getByRole('button', { name: /import transcript/i })).toBeInTheDocument()
  })

  it('Import Transcript button is visible even when the course list is empty', () => {
    setup([])
    expect(screen.getByRole('button', { name: /import transcript/i })).toBeInTheDocument()
  })

  it('clicking Import Transcript opens the modal', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: /import transcript/i }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText('Import Transcript')).toBeInTheDocument()
  })

  it('modal contains the TranscriptUpload component', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: /import transcript/i }))

    expect(screen.getByTestId('transcript-upload')).toBeInTheDocument()
  })

  it('modal closes when the × button is clicked', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: /import transcript/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Close modal'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('modal closes after a successful import', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: /import transcript/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    capturedOnCoursesAdded([MOCK_CURRENT_COURSE as never])

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('modal stays open when onCoursesAdded is called with an empty array', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: /import transcript/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    capturedOnCoursesAdded([])

    // Dialog should still be present after empty import
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('modal closes when the Close button is clicked', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: /import transcript/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^close$/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // ── Add Class button ──────────────────────────────────────────────────────

  it('clicking Add Class reveals the CourseSelector panel', async () => {
    const user = userEvent.setup()
    setup()

    expect(screen.queryByTestId('course-selector')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /add class/i }))
    expect(screen.getByTestId('course-selector')).toBeInTheDocument()
  })
})
