import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, makeMutationFn } from './utils'
import PreferencesPage from '../src/pages/PreferencesPage'

vi.mock('../../backend/convex/_generated/api', () => ({
  api: {
    queries: {
      users: { getCurrUser: 'getCurrUser' },
      userCourses: { getUserCourses: 'getUserCourses' },
      calendar: { getCalendarConnectionStatus: 'getCalendarConnectionStatus' },
    },
    mutations: {
      users: { updateUserSettings: 'updateUserSettings' },
      studyBlocks: { runDetectConflicts: 'runDetectConflicts' },
    },
  },
}))

vi.mock('../src/components/Sidebar', () => ({ default: () => <div data-testid="sidebar" /> }))

vi.mock('../src/components/ProfileForm', () => ({
  default: ({ readOnly }: { readOnly: boolean }) => (
    <div data-testid="profile-form" data-readonly={String(readOnly)} />
  ),
}))

vi.mock('../src/components/WorkHoursSelector', () => ({
  default: ({ readOnly }: { readOnly: boolean }) => (
    <div data-testid="work-hours-selector" data-readonly={String(readOnly)} />
  ),
  DEFAULT_WORK_HOURS: {},
}))

vi.mock('../src/components/PreferencesForm', () => ({
  default: ({ readOnly }: { readOnly: boolean }) => (
    <div data-testid="preferences-form" data-readonly={String(readOnly)} />
  ),
}))

vi.mock('../src/components/AcademicProfileSummary', () => ({
  default: ({ profile }: { profile: { major: string } }) => (
    <div data-testid="academic-profile-summary" data-major={profile.major} />
  ),
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

import { useQuery, useMutation } from 'convex/react'

const mockUseQuery = vi.mocked(useQuery)
const mockUseMutation = vi.mocked(useMutation)

const MOCK_USER = {
  major: 'Computer Science',
  year: 'Junior',
  courses: [{ title: 'Data Structures', studyGoal: 'A' }],
  workHoursGrid: [{ day: 'Monday', available: [1, 2], blocked: [] }],
  productivityTraits: { timeOfDay: ['Morning (8–11am)'] },
  focusBlockLength: 60,
  gcalColorMappingEnabled: false,
}

function setup({
  user = MOCK_USER as typeof MOCK_USER | null,
  calendarConnected = false,
} = {}) {
  const updateSettings = makeMutationFn()
  mockUseQuery.mockImplementation((...args: Parameters<typeof useQuery>) => {
    const key = args[0] as unknown as string
    if (key === 'getCalendarConnectionStatus') {
      return { connected: calendarConnected, hasEventsScope: calendarConnected } as never
    }
    if (key === 'getUserCourses') {
      return (user as typeof MOCK_USER | null)?.courses ?? [] as never
    }
    return user as never
  })
  mockUseMutation.mockReturnValue(updateSettings as never)
  renderWithProviders(<PreferencesPage />)
  return { updateSettings }
}

describe('PreferencesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Academic Profile Summary ───────────────────────────────────────────────

  it('renders academic profile summary without expanding any section', () => {
    setup()
    expect(screen.getByTestId('academic-profile-summary')).toBeInTheDocument()
  })

  it('passes user profile data to AcademicProfileSummary', () => {
    setup()
    expect(screen.getByTestId('academic-profile-summary')).toHaveAttribute('data-major', 'Computer Science')
  })

  it('academic profile summary is visible even while a section is open', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('About You'))
    expect(screen.getByTestId('academic-profile-summary')).toBeInTheDocument()
  })

  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders the page header', () => {
    setup()
    expect(screen.getByText('Preferences')).toBeInTheDocument()
  })

  it('renders all three section titles', () => {
    setup()
    expect(screen.getByText('About You')).toBeInTheDocument()
    expect(screen.getByText('Work Hours')).toBeInTheDocument()
    expect(screen.getByText('Productivity Preferences')).toBeInTheDocument()
  })

  it('sections are collapsed by default', () => {
    setup()
    expect(screen.queryByTestId('profile-form')).not.toBeInTheDocument()
    expect(screen.queryByTestId('work-hours-selector')).not.toBeInTheDocument()
    expect(screen.queryByTestId('preferences-form')).not.toBeInTheDocument()
  })

  // ── Accordion ──────────────────────────────────────────────────────────────

  it('expands About You on click', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('About You'))
    expect(screen.getByTestId('profile-form')).toBeInTheDocument()
  })

  it('expands Work Hours on click', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('Work Hours'))
    expect(screen.getByTestId('work-hours-selector')).toBeInTheDocument()
  })

  it('expands Productivity Preferences on click', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('Productivity Preferences'))
    expect(screen.getByTestId('preferences-form')).toBeInTheDocument()
  })

  it('collapses section when clicked again', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('About You'))
    expect(screen.getByTestId('profile-form')).toBeInTheDocument()
    await user.click(screen.getByText('About You'))
    expect(screen.queryByTestId('profile-form')).not.toBeInTheDocument()
  })

  // ── Edit button visibility ─────────────────────────────────────────────────

  it('does not show Edit button when section is closed', () => {
    setup()
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()
  })

  it('shows Edit button in the header when a section is open', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('About You'))
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
  })

  // ── Edit mode ──────────────────────────────────────────────────────────────

  it('switches component to editable when Edit is clicked', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('About You'))
    await user.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(screen.getByTestId('profile-form')).toHaveAttribute('data-readonly', 'false')
  })

  it('shows Save and Cancel buttons in edit mode', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('About You'))
    await user.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('returns to readOnly on Cancel without calling the mutation', async () => {
    const user = userEvent.setup()
    const { updateSettings } = setup()
    await user.click(screen.getByText('About You'))
    await user.click(screen.getByRole('button', { name: /^edit$/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByTestId('profile-form')).toHaveAttribute('data-readonly', 'true')
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it('cancels edit when section is closed while editing', async () => {
    const user = userEvent.setup()
    const { updateSettings } = setup()
    await user.click(screen.getByText('About You'))
    await user.click(screen.getByRole('button', { name: /^edit$/i }))
    await user.click(screen.getByText('About You')) // close
    await user.click(screen.getByText('About You')) // reopen
    expect(screen.getByTestId('profile-form')).toHaveAttribute('data-readonly', 'true')
    expect(updateSettings).not.toHaveBeenCalled()
  })

  // ── Save ───────────────────────────────────────────────────────────────────

  it('calls updateUserSettings with profile fields on save', async () => {
    const user = userEvent.setup()
    const { updateSettings } = setup()
    await user.click(screen.getByText('About You'))
    await user.click(screen.getByRole('button', { name: /^edit$/i }))
    await user.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ major: 'Computer Science', year: 'Junior' })
      )
    })
  })

  it('calls updateUserSettings with workHoursGrid on save', async () => {
    const user = userEvent.setup()
    const { updateSettings } = setup()
    await user.click(screen.getByText('Work Hours'))
    await user.click(screen.getByRole('button', { name: /^edit$/i }))
    await user.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          workHoursGrid: expect.arrayContaining([
            expect.objectContaining({ day: 'Monday' }),
          ]),
        })
      )
    })
  })

  it('calls updateUserSettings with productivityTraits and focusBlockLength on save', async () => {
    const user = userEvent.setup()
    const { updateSettings } = setup()
    await user.click(screen.getByText('Productivity Preferences'))
    await user.click(screen.getByRole('button', { name: /^edit$/i }))
    await user.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          productivityTraits: { timeOfDay: ['Morning (8–11am)'] },
          focusBlockLength: 60,
        })
      )
    })
  })

  it('returns to readOnly after a successful save', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('About You'))
    await user.click(screen.getByRole('button', { name: /^edit$/i }))
    await user.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(screen.getByTestId('profile-form')).toHaveAttribute('data-readonly', 'true')
    })
  })
})

// ── GCal color mapping toggle ──────────────────────────────────────────────────

describe('PreferencesPage – GCal color mapping toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render the toggle when calendar is not connected', () => {
    setup({ calendarConnected: false })
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('renders the toggle when calendar is connected', () => {
    setup({ calendarConnected: true })
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('renders the label and description text', () => {
    setup({ calendarConnected: true })
    expect(screen.getByText('Map Timemaxx course color to exported Google Calendar blocks')).toBeInTheDocument()
    expect(screen.getByText(/use your course colors/i)).toBeInTheDocument()
  })

  it('toggle is unchecked when gcalColorMappingEnabled is false', () => {
    setup({ calendarConnected: true, user: { ...MOCK_USER, gcalColorMappingEnabled: false } })
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('toggle is checked when gcalColorMappingEnabled is true', () => {
    setup({ calendarConnected: true, user: { ...MOCK_USER, gcalColorMappingEnabled: true } })
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('calls updateUserSettings with gcalColorMappingEnabled: true when toggled on', async () => {
    const user = userEvent.setup()
    const { updateSettings } = setup({
      calendarConnected: true,
      user: { ...MOCK_USER, gcalColorMappingEnabled: false },
    })
    await user.click(screen.getByRole('switch'))
    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({ gcalColorMappingEnabled: true })
    })
  })

  it('calls updateUserSettings with gcalColorMappingEnabled: false when toggled off', async () => {
    const user = userEvent.setup()
    const { updateSettings } = setup({
      calendarConnected: true,
      user: { ...MOCK_USER, gcalColorMappingEnabled: true },
    })
    await user.click(screen.getByRole('switch'))
    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({ gcalColorMappingEnabled: false })
    })
  })

  it('does not render the toggle after calendar is disconnected', () => {
    // Simulate disconnected state: calendarConnected false even if user still
    // has a stale gcalColorMappingEnabled value in DB.
    setup({ calendarConnected: false, user: { ...MOCK_USER, gcalColorMappingEnabled: true } })
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })
})
