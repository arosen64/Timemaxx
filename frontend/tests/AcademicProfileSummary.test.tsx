import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useQuery, useMutation, useAction } from 'convex/react'
import AcademicProfileSummary from '../src/components/AcademicProfileSummary'
import { ProfileData } from '../src/types'

vi.mock('../../backend/convex/_generated/api', () => ({
  api: {
    ai: {
      generateAcademicProfile: { generateAcademicProfile: 'generateAcademicProfile' },
    },
    mutations: {
      users: { updateUserSettings: 'updateUserSettings' },
    },
    queries: {
      users: { getCurrUser: 'getCurrUser' },
      userCourses: { getUserCourses: 'getUserCourses' },
    },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useAction: vi.fn(),
}))

const mockUseQuery = vi.mocked(useQuery)
const mockUseMutation = vi.mocked(useMutation)
const mockUseAction = vi.mocked(useAction)

const DEFAULT_PROFILE: ProfileData = {
  major: 'CS',
  year: 'Junior',
  difficultSubjects: [],
  enjoyedSubjects: [],
  courses: [],
}

function setup({
  courses = [] as ProfileData['courses'],
  currUser = { transcriptSummary: [] as { label: string; text: string }[] },
  generateResult = [{ label: 'Strength', text: 'You excel at math.' }],
  generateShouldFail = false,
} = {}) {
  const onChange = vi.fn()
  const mockGenerate = generateShouldFail
    ? vi.fn().mockRejectedValue(new Error('API error'))
    : vi.fn().mockResolvedValue(generateResult)
  const mockUpdateSettings = vi.fn().mockResolvedValue(undefined)

  mockUseQuery.mockImplementation(((query: unknown) => {
    if (query === 'getUserCourses') return courses
    if (query === 'getCurrUser') return currUser
    return undefined
  }) as never)
  mockUseMutation.mockReturnValue(mockUpdateSettings as never)
  mockUseAction.mockReturnValue(mockGenerate as never)

  render(<AcademicProfileSummary profile={DEFAULT_PROFILE} onChange={onChange} />)
  return { onChange, mockGenerate, mockUpdateSettings }
}

describe('AcademicProfileSummary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows "Loading..." while queries are not yet resolved', () => {
    mockUseQuery.mockReturnValue(undefined as never)
    mockUseMutation.mockReturnValue(vi.fn() as never)
    mockUseAction.mockReturnValue(vi.fn() as never)
    render(<AcademicProfileSummary profile={DEFAULT_PROFILE} onChange={vi.fn()} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows empty state when no courses are added', () => {
    setup({ courses: [], currUser: { transcriptSummary: [] } })
    expect(screen.getByText(/no courses added yet/i)).toBeInTheDocument()
  })

  it('auto-generates when courses exist and no summary is stored', async () => {
    const { mockGenerate } = setup({
      courses: [{ title: 'CS 101', studyGoal: 'Do well' }],
      currUser: { transcriptSummary: [] },
    })

    await waitFor(() => expect(mockGenerate).toHaveBeenCalledTimes(1))
  })

  it('does not auto-generate when a summary already exists', () => {
    const { mockGenerate } = setup({
      courses: [{ title: 'CS 101', studyGoal: 'Do well' }],
      currUser: { transcriptSummary: [{ label: 'Strength', text: 'You are great.' }] },
    })

    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('renders existing insights from currUser', () => {
    setup({
      courses: [{ title: 'CS 101', studyGoal: 'Do well' }],
      currUser: { transcriptSummary: [{ label: 'Strength', text: 'You excel at math.' }] },
    })

    expect(screen.getByText('Strength')).toBeInTheDocument()
    expect(screen.getByText('You excel at math.')).toBeInTheDocument()
  })

  it('shows Regenerate button when courses exist and summary is loaded', () => {
    setup({
      courses: [{ title: 'CS 101', studyGoal: 'Do well' }],
      currUser: { transcriptSummary: [{ label: 'Strength', text: 'You excel at math.' }] },
    })

    expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument()
  })

  it('calls generate when Regenerate is clicked', async () => {
    const user = userEvent.setup()
    const { mockGenerate } = setup({
      courses: [{ title: 'CS 101', studyGoal: 'Do well' }],
      currUser: { transcriptSummary: [{ label: 'Strength', text: 'You excel at math.' }] },
    })

    await user.click(screen.getByRole('button', { name: /regenerate/i }))

    await waitFor(() => expect(mockGenerate).toHaveBeenCalledTimes(1))
  })

  it('shows error message and Try again button when generation fails', async () => {
    setup({
      courses: [{ title: 'CS 101', studyGoal: 'Do well' }],
      currUser: { transcriptSummary: [] },
      generateShouldFail: true,
    })

    await waitFor(() =>
      expect(screen.getByText(/failed to generate your academic profile/i)).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
