import { screen, waitFor } from '@testing-library/react'
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
      calendar: { deleteCalendarToken: 'deleteCalendarToken' },
    },
    actions: {
      initiateGoogleCalendarOAuth: {
        initiateGoogleCalendarOAuth: 'initiateGoogleCalendarOAuth',
      },
    },
  },
}))

vi.mock('../src/components/Sidebar', () => ({ default: () => <div data-testid="sidebar" /> }))

vi.mock('@convex-dev/auth/react', () => ({
  useAuthActions: () => ({ signOut: vi.fn().mockResolvedValue(undefined) }),
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

function setup(calendarConnected: boolean) {
  const mockAction = makeMutationFn('https://accounts.google.com/oauth')
  const mockMutation = makeMutationFn()
  mockUseQuery.mockImplementation((query) => {
    if (query === 'getCalendarConnectionStatus') return { connected: calendarConnected }
    return MOCK_USER
  })
  mockUseMutation.mockReturnValue(mockMutation as never)
  mockUseAction.mockReturnValue(mockAction as never)
  renderWithProviders(<ProfilePage />)
  return { mockAction, mockMutation }
}

describe('ProfilePage – Google Calendar section', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
  })

  it('renders "Connect Calendar" button when not connected', () => {
    setup(false)
    expect(screen.getByRole('button', { name: /connect calendar/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /revoke access/i })).not.toBeInTheDocument()
  })

  it('renders "Revoke Access" button when connected', () => {
    setup(true)
    expect(screen.getByRole('button', { name: /revoke access/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /connect calendar/i })).not.toBeInTheDocument()
  })

  it('calls initiateGoogleCalendarOAuth when "Connect Calendar" is clicked', async () => {
    const user = userEvent.setup()
    const { mockAction } = setup(false)

    await user.click(screen.getByRole('button', { name: /connect calendar/i }))

    await waitFor(() => expect(mockAction).toHaveBeenCalledWith({}))
  })

  it('calls deleteCalendarToken when "Revoke Access" is clicked', async () => {
    const user = userEvent.setup()
    const { mockMutation } = setup(true)

    await user.click(screen.getByRole('button', { name: /revoke access/i }))

    await waitFor(() => expect(mockMutation).toHaveBeenCalledWith({}))
  })
})
