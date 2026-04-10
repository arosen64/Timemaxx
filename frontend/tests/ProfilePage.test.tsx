import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, makeMutationFn } from './utils'
import ProfilePage from '../src/pages/ProfilePage'

vi.mock('../../backend/convex/_generated/api', () => ({
  api: {
    queries: {
      users: { getCurrUser: 'getCurrUser' },
      calendar: { getCalendarConnectionStatus: 'getCalendarConnectionStatus' },
    },
    mutations: {
      users: { deleteAccount: 'deleteAccount' },
    },
    actions: {
      initiateGoogleCalendarOAuth: {
        initiateGoogleCalendarOAuth: 'initiateGoogleCalendarOAuth',
      },
      exportStudyBlocksToCalendar: {
        revokeCalendarAccess: 'revokeCalendarAccess',
      },
    },
  },
}))

vi.mock('../src/components/Sidebar', () => ({ default: () => <div data-testid="sidebar" /> }))

const mockSignOut = vi.fn().mockResolvedValue(undefined)
vi.mock('@convex-dev/auth/react', () => ({
  useAuthActions: () => ({ signOut: mockSignOut }),
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useAction: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { useQuery, useMutation, useAction } from 'convex/react'

const mockUseQuery = vi.mocked(useQuery)
const mockUseMutation = vi.mocked(useMutation)
const mockUseAction = vi.mocked(useAction)

const MOCK_USER = {
  _id: 'user1',
  name: 'Alex Johnson',
  email: 'alex@example.com',
  onboardingComplete: true,
  major: 'Computer Science',
  year: 'Junior',
}

function setup(calendarStatus: { connected: boolean; hasEventsScope: boolean } | undefined) {
  const mockOAuthAction = makeMutationFn('https://accounts.google.com/oauth')
  const mockRevokeAction = makeMutationFn()
  const mockMutation = makeMutationFn()
  mockUseQuery.mockImplementation(((query: string) => {
    if (query === 'getCalendarConnectionStatus') return calendarStatus
    return MOCK_USER
  }) as never)
  mockUseMutation.mockReturnValue(mockMutation as never)
  mockUseAction.mockImplementation(((key: string) => {
    if (key === 'revokeCalendarAccess') return mockRevokeAction
    return mockOAuthAction
  }) as never)
  renderWithProviders(<ProfilePage />)
  return { mockOAuthAction, mockRevokeAction, mockMutation }
}

describe('ProfilePage – Google Calendar section', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
    mockSignOut.mockClear()
  })

  it('renders loading skeleton when calendar status is loading', () => {
    setup(undefined)
    expect(screen.queryByRole('button', { name: /connect calendar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /revoke access/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /update calendar permissions/i })).not.toBeInTheDocument()
  })

  it('renders "Connect Calendar" button when not connected', () => {
    setup({ connected: false, hasEventsScope: false })
    expect(screen.getByRole('button', { name: /connect calendar/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /revoke access/i })).not.toBeInTheDocument()
  })

  it('renders "Revoke Access" button when connected with full scope', () => {
    setup({ connected: true, hasEventsScope: true })
    expect(screen.getByRole('button', { name: /revoke access/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /connect calendar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /update calendar permissions/i })).not.toBeInTheDocument()
  })

  it('renders "Update Calendar Permissions" button when connected with limited scope', () => {
    setup({ connected: true, hasEventsScope: false })
    expect(screen.getByRole('button', { name: /update calendar permissions/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /revoke access/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /connect calendar/i })).not.toBeInTheDocument()
  })

  it('calls initiateGoogleCalendarOAuth when "Connect Calendar" is clicked', async () => {
    const user = userEvent.setup()
    const { mockOAuthAction } = setup({ connected: false, hasEventsScope: false })

    await user.click(screen.getByRole('button', { name: /connect calendar/i }))

    await waitFor(() => expect(mockOAuthAction).toHaveBeenCalledWith({}))
  })

  it('calls initiateGoogleCalendarOAuth when "Update Calendar Permissions" is clicked', async () => {
    const user = userEvent.setup()
    const { mockOAuthAction } = setup({ connected: true, hasEventsScope: false })

    await user.click(screen.getByRole('button', { name: /update calendar permissions/i }))

    await waitFor(() => expect(mockOAuthAction).toHaveBeenCalledWith({}))
  })

  it('calls revokeCalendarAccess when "Revoke Access" is clicked', async () => {
    const user = userEvent.setup()
    const { mockRevokeAction } = setup({ connected: true, hasEventsScope: true })

    await user.click(screen.getByRole('button', { name: /revoke access/i }))

    await waitFor(() => expect(mockRevokeAction).toHaveBeenCalledWith({}))
  })
})

describe('ProfilePage – profile info section', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
    mockSignOut.mockClear()
  })

  it('renders user name and email when data is loaded', () => {
    setup({ connected: false, hasEventsScope: false })
    // Name and email each appear in both ProfileAvatar and ProfileField
    expect(screen.getAllByText('Alex Johnson').length).toBeGreaterThan(0)
    expect(screen.getAllByText('alex@example.com').length).toBeGreaterThan(0)
  })

  it('renders major and year when onboarding is complete', () => {
    setup({ connected: false, hasEventsScope: false })
    expect(screen.getByText('Computer Science')).toBeInTheDocument()
    expect(screen.getByText('Junior')).toBeInTheDocument()
  })

  it('hides user data and shows skeletons when user is loading', () => {
    mockUseQuery.mockReturnValue(undefined)
    mockUseMutation.mockReturnValue(makeMutationFn() as never)
    mockUseAction.mockReturnValue(makeMutationFn() as never)
    renderWithProviders(<ProfilePage />)
    expect(screen.queryByText('Alex Johnson')).not.toBeInTheDocument()
    expect(screen.queryByText('alex@example.com')).not.toBeInTheDocument()
  })

  it('shows onboarding prompt when onboarding is incomplete', () => {
    mockUseQuery.mockImplementation(((query: string) => {
      if (query === 'getCalendarConnectionStatus') return { connected: false, hasEventsScope: false }
      return { ...MOCK_USER, onboardingComplete: false }
    }) as never)
    mockUseMutation.mockReturnValue(makeMutationFn() as never)
    mockUseAction.mockReturnValue(makeMutationFn() as never)
    renderWithProviders(<ProfilePage />)
    expect(screen.getByRole('button', { name: /complete onboarding survey/i })).toBeInTheDocument()
    expect(screen.queryByText('Computer Science')).not.toBeInTheDocument()
  })

  it('navigates to /onboarding when "Complete Onboarding Survey" is clicked', async () => {
    const user = userEvent.setup()
    mockUseQuery.mockImplementation(((query: string) => {
      if (query === 'getCalendarConnectionStatus') return { connected: false, hasEventsScope: false }
      return { ...MOCK_USER, onboardingComplete: false }
    }) as never)
    mockUseMutation.mockReturnValue(makeMutationFn() as never)
    mockUseAction.mockReturnValue(makeMutationFn() as never)
    renderWithProviders(<ProfilePage />)

    await user.click(screen.getByRole('button', { name: /complete onboarding survey/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/onboarding')
  })
})

describe('ProfilePage – account actions section', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
    mockSignOut.mockClear()
  })

  it('renders Log Out and Delete Account buttons', () => {
    setup({ connected: false, hasEventsScope: false })
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument()
  })

  it('opens delete confirmation modal when Delete Account is clicked', async () => {
    const user = userEvent.setup()
    setup({ connected: false, hasEventsScope: false })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /delete account/i }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText(/permanently deleted/i)).toBeInTheDocument()
  })

  it('closes the modal when Cancel is clicked', async () => {
    const user = userEvent.setup()
    setup({ connected: false, hasEventsScope: false })

    await user.click(screen.getByRole('button', { name: /delete account/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls deleteAccount mutation, signs out, and navigates to / when deletion is confirmed', async () => {
    const user = userEvent.setup()
    const { mockMutation } = setup({ connected: false, hasEventsScope: false })

    await user.click(screen.getByRole('button', { name: /delete account/i }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /delete account/i }))

    await waitFor(() => {
      expect(mockMutation).toHaveBeenCalled()
      expect(mockSignOut).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  it('signs out and navigates to / when Log Out is clicked', async () => {
    const user = userEvent.setup()
    setup({ connected: false, hasEventsScope: false })

    await user.click(screen.getByRole('button', { name: /log out/i }))

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })
})
