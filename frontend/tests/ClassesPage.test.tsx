import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, makeMutationFn } from './utils'
import ClassesPage from '../src/pages/ClassesPage'

vi.mock('../../backend/convex/_generated/api', () => ({
  api: {
    queries: {
      userCourses: {
        getUserCourses: 'getUserCourses',
        getCourseMetadata: 'getCourseMetadata',
      },
    },
    mutations: {
      userCourses: { deleteUserCourse: 'deleteUserCourse' },
    },
  },
}))

vi.mock('../src/components/Sidebar', () => ({ default: () => <div data-testid="sidebar" /> }))

// ClassCard has significant internal state; mock it so page tests stay focused
vi.mock('../src/components/classes/ClassCard', () => ({
  default: ({ title }: { title: string }) => (
    <div data-testid="class-card" data-title={title} />
  ),
}))

vi.mock('../src/components/CourseSelector', () => ({
  default: () => <div data-testid="course-selector" />,
}))

vi.mock('../src/components/TranscriptUpload', () => ({
  default: ({ onCoursesAdded }: { onCoursesAdded: (courses: unknown[]) => void }) => (
    <div data-testid="transcript-upload">
      <button onClick={() => onCoursesAdded([{}])}>Finish Upload</button>
    </div>
  ),
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

import { useQuery, useMutation } from 'convex/react'

const mockUseQuery = vi.mocked(useQuery)
const mockUseMutation = vi.mocked(useMutation)

// Use stable terms: Fall 2099 is always current, Fall 2020 is always past
const MOCK_CURRENT = {
  _id: 'uc1',
  courseCode: 'CS101',
  title: 'Intro to CS',
  term: 'Fall 2099',
}

const MOCK_PAST = {
  _id: 'uc2',
  courseCode: 'MATH201',
  title: 'Calculus II',
  term: 'Fall 2020',
  grade: 'A',
}

const MOCK_METADATA = [
  { courseId: 'uc1', hasSyllabus: false, taskCount: 0 },
  { courseId: 'uc2', hasSyllabus: true, taskCount: 5 },
]

function setup(
  courses: typeof MOCK_CURRENT[] | undefined = [MOCK_CURRENT, MOCK_PAST],
  metadata = MOCK_METADATA
) {
  mockUseQuery.mockImplementation((query) => {
    if (query === 'getUserCourses') return courses
    if (query === 'getCourseMetadata') return metadata
    return undefined
  })
  mockUseMutation.mockReturnValue(makeMutationFn() as never)
  return renderWithProviders(<ClassesPage />)
}

describe('ClassesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Loading state ────────────────────────────────────────────────────────────

  it('shows skeleton cards and no course content when courses are undefined', () => {
    mockUseQuery.mockImplementation((query) => {
      if (query === 'getUserCourses') return undefined
      if (query === 'getCourseMetadata') return MOCK_METADATA
      return undefined
    })
    mockUseMutation.mockReturnValue(makeMutationFn() as never)
    const { container } = renderWithProviders(<ClassesPage />)
    expect(screen.queryByTestId('class-card')).not.toBeInTheDocument()
    expect(screen.queryByText(/no current classes/i)).not.toBeInTheDocument()
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
  })

  it('shows skeleton cards when courseMetadata is undefined', () => {
    mockUseQuery.mockImplementation((query) => {
      if (query === 'getUserCourses') return [MOCK_CURRENT]
      if (query === 'getCourseMetadata') return undefined
      return undefined
    })
    mockUseMutation.mockReturnValue(makeMutationFn() as never)
    const { container } = renderWithProviders(<ClassesPage />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
  })

  // ── Tab counts ───────────────────────────────────────────────────────────────

  it('shows correct count badges on Current and Past tabs', () => {
    setup()
    // Tab labels contain the count badges: "current 1" and "past 1"
    const currentTab = screen.getByRole('button', { name: /current/i })
    const pastTab = screen.getByRole('button', { name: /past/i })
    expect(currentTab).toHaveTextContent('1')
    expect(pastTab).toHaveTextContent('1')
  })

  // ── Tab switching ────────────────────────────────────────────────────────────

  it('shows only past courses when Past tab is clicked', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: /^past/i }))
    const cards = screen.getAllByTestId('class-card')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveAttribute('data-title', 'Calculus II')
  })

  // ── Empty states ─────────────────────────────────────────────────────────────

  it('shows "No current classes" when there are no current courses', () => {
    setup([MOCK_PAST])
    expect(screen.getByText('No current classes')).toBeInTheDocument()
  })

  it('shows "No past classes" when Past tab is active and there are no past courses', async () => {
    const user = userEvent.setup()
    setup([MOCK_CURRENT])
    await user.click(screen.getByRole('button', { name: /^past/i }))
    expect(screen.getByText('No past classes')).toBeInTheDocument()
  })

  // ── Add Class panel ──────────────────────────────────────────────────────────

  it('shows CourseSelector panel when Add Class is clicked', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: /add class/i }))
    expect(screen.getByTestId('course-selector')).toBeInTheDocument()
  })

  it('hides CourseSelector panel when Cancel is clicked', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: /add class/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByTestId('course-selector')).not.toBeInTheDocument()
  })

  // ── Import Transcript button ─────────────────────────────────────────────────

  it('shows Import Transcript button when courses are loaded', () => {
    setup()
    expect(screen.getByRole('button', { name: /import transcript/i })).toBeInTheDocument()
  })

  it('shows Import Transcript button when there are no courses', () => {
    setup([])
    expect(screen.getByRole('button', { name: /import transcript/i })).toBeInTheDocument()
  })

  it('opens transcript overlay when Import Transcript is clicked', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: /import transcript/i }))
    expect(screen.getByTestId('transcript-upload')).toBeInTheDocument()
  })

  it('closes transcript overlay when onCoursesAdded is called with courses', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: /import transcript/i }))
    await user.click(screen.getByRole('button', { name: /finish upload/i }))
    expect(screen.queryByTestId('transcript-upload')).not.toBeInTheDocument()
  })

  it('empty-state Add Class button opens CourseSelector panel', async () => {
    const user = userEvent.setup()
    setup([])
    // The empty state renders its own Add Class button
    const addButtons = screen.getAllByRole('button', { name: /add class/i })
    // Click the one inside the empty state (the second button — header button is first)
    await user.click(addButtons[addButtons.length - 1])
    expect(screen.getByTestId('course-selector')).toBeInTheDocument()
  })
})
