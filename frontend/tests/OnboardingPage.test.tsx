import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, makeMutationFn } from './utils'
import OnboardingPage from '../src/pages/OnboardingPage'

vi.mock('../../backend/convex/_generated/api', () => ({
  api: {
    queries: {
      users: { isOnboardingComplete: 'isOnboardingComplete' },
      calendar: { getCalendarConnectionStatus: 'getCalendarConnectionStatus' },
    },
    mutations: {
      users: { completeOnboarding: 'completeOnboarding' },
      userCourses: { addUserCourse: 'addUserCourse', deleteUserCourse: 'deleteUserCourse', updateUserCourse: 'updateUserCourse' },
    },
    actions: {
      initiateGoogleCalendarOAuth: {
        initiateGoogleCalendarOAuth: 'initiateGoogleCalendarOAuth',
      },
      jhuCourses: {
        getAvailableTerms: 'getAvailableTerms',
        getAvailableSchools: 'getAvailableSchools',
        getCoursesByTerm: 'getCoursesByTerm',
      },
      parseTranscript: { parseTranscript: 'parseTranscript' },
    },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useAction: vi.fn(),
}))

// Mock useNavigate so we can assert redirects without a real router history
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { useQuery, useMutation, useAction } from 'convex/react'

const mockUseQuery = vi.mocked(useQuery)
const mockUseMutation = vi.mocked(useMutation)
const mockUseAction = vi.mocked(useAction)

/** Renders OnboardingPage with onboarding not yet complete */
function setup(calendarConnected = false) {
  const saveOnboarding = makeMutationFn()
  const mockCalendarAction = makeMutationFn('https://accounts.google.com/oauth')
  mockUseQuery.mockImplementation(((query: unknown) => {
    if (query === 'getCalendarConnectionStatus') return { connected: calendarConnected }
    return false
  }) as never)
  mockUseMutation.mockReturnValue(saveOnboarding as never)
  mockUseAction.mockImplementation((action: unknown) => {
    if (action === 'initiateGoogleCalendarOAuth') return mockCalendarAction as never
    return vi.fn().mockResolvedValue([]) as never
  })
  renderWithProviders(<OnboardingPage />)
  return { saveOnboarding, mockCalendarAction }
}

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
  })

  it('redirects to /dashboard if onboarding is already complete', async () => {
    mockUseQuery.mockReturnValue(true)
    mockUseMutation.mockReturnValue(makeMutationFn() as never)
    mockUseAction.mockReturnValue(vi.fn().mockResolvedValue([]) as never)

    renderWithProviders(<OnboardingPage />)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('renders Step 1 (Profile) initially', () => {
    setup()
    expect(screen.getByText('Tell us about yourself')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/computer science/i)).toBeInTheDocument()
  })

  it('does not advance from Step 1 when required fields are empty', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(screen.getByText('Major is required')).toBeInTheDocument()
    expect(screen.getByText('Please select your year')).toBeInTheDocument()
    // Still on step 1
    expect(screen.getByText('Tell us about yourself')).toBeInTheDocument()
  })

  it('advances to Step 2 after filling required fields in Step 1', async () => {
    const user = userEvent.setup()
    setup()

    await user.type(screen.getByPlaceholderText(/computer science/i), 'Computer Science')
    await user.selectOptions(document.getElementById('year-select')!, 'Junior')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => {
      // Step 2 renders WorkHoursSelector — look for its heading
      expect(screen.queryByText('Tell us about yourself')).not.toBeInTheDocument()
    })
  })

  it('advances to Step 4 from Step 3', async () => {
    const user = userEvent.setup()
    setup()

    // Complete step 1
    await user.type(screen.getByPlaceholderText(/computer science/i), 'Biology')
    await user.selectOptions(document.getElementById('year-select')!, 'Sophomore')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // Step 2 (CoursesForm) — advance
    await waitFor(() => expect(screen.queryByText('Tell us about yourself')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // Step 3 (WorkHoursSelector) — advance
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // Step 4: PreferencesForm should be visible
    await waitFor(() => {
      expect(screen.getByText('Productivity Preferences')).toBeInTheDocument()
    })
  })

  it('navigates back from Step 2 to Step 1 with data preserved', async () => {
    const user = userEvent.setup()
    setup()

    await user.type(screen.getByPlaceholderText(/computer science/i), 'Physics')
    await user.selectOptions(document.getElementById('year-select')!, 'Senior')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => expect(screen.queryByText('Tell us about yourself')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /back/i }))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Physics')).toBeInTheDocument()
    })
  })

  it('calls saveOnboarding with correct data and navigates to /dashboard on submit', async () => {
    const user = userEvent.setup()
    const { saveOnboarding } = setup()

    // Step 1
    await user.type(screen.getByPlaceholderText(/computer science/i), 'Math')
    await user.selectOptions(document.getElementById('year-select')!, 'Freshman')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // Step 2 (CoursesForm) — advance
    await waitFor(() => expect(screen.queryByText('Tell us about yourself')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // Step 3 (WorkHoursSelector) — advance
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // Step 4 (PreferencesForm) — advance
    await waitFor(() => expect(screen.getByText('Productivity Preferences')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // Step 5 (Calendar) — click Finish to navigate to /dashboard
    await waitFor(() => expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /finish/i }))

    await waitFor(() => {
      expect(saveOnboarding).toHaveBeenCalledWith(
        expect.objectContaining({
          major: 'Math',
          year: 'Freshman',
        })
      )
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('Back button is not shown on Step 1', () => {
    setup()
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
  })
})

describe('OnboardingPage – Google Calendar section (Step 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
  })

  async function advanceToStep4() {
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/computer science/i), 'Biology')
    await user.selectOptions(document.getElementById('year-select')!, 'Sophomore')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    // Step 2 (CoursesForm)
    await waitFor(() => expect(screen.queryByText('Tell us about yourself')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /continue/i }))
    // Step 3 (WorkHours)
    await waitFor(() => screen.getByRole('button', { name: /continue/i }))
    await user.click(screen.getByRole('button', { name: /continue/i }))
    // Step 4 (Preferences)
    await waitFor(() => expect(screen.getByText('Productivity Preferences')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /continue/i }))
    // Step 5 (Calendar)
    await waitFor(() => expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument())
    return user
  }

  it('shows "Connect" button on Step 4 when calendar is not connected', async () => {
    setup(false)
    await advanceToStep4()
    expect(screen.getByRole('button', { name: /^connect$/i })).toBeInTheDocument()
    expect(screen.queryByText('Connected')).not.toBeInTheDocument()
  })

  it('shows "Connected" indicator on Step 4 when calendar is already connected', async () => {
    setup(true)
    await advanceToStep4()
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^connect$/i })).not.toBeInTheDocument()
  })

  it('calls initiateGoogleCalendarOAuth when "Connect" is clicked on Step 4', async () => {
    const { mockCalendarAction } = setup(false)
    const user = await advanceToStep4()

    await user.click(screen.getByRole('button', { name: /^connect$/i }))

    await waitFor(() => expect(mockCalendarAction).toHaveBeenCalledWith({}))
  })
})
