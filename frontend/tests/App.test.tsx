import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from './utils'
import App from '../src/App'

// Mock page components so routing tests stay focused on redirect logic
vi.mock('../src/pages/LandingPage', () => ({ default: () => <div>Landing Page</div> }))
vi.mock('../src/pages/OnboardingPage', () => ({ default: () => <div>Onboarding Page</div> }))
vi.mock('../src/pages/DashboardPage', () => ({ default: () => <div>Dashboard Page</div> }))
vi.mock('../src/pages/ProfilePage', () => ({ default: () => <div>Profile Page</div> }))
vi.mock('../src/pages/SchedulePage', () => ({ default: () => <div>Schedule Page</div> }))
vi.mock('../src/pages/PreferencesPage', () => ({ default: () => <div>Preferences Page</div> }))
vi.mock('../src/pages/ClassesPage', () => ({ default: () => <div>Classes Page</div> }))
vi.mock('../src/pages/SyllabusReviewPage', () => ({ default: () => <div>Syllabus Review Page</div> }))

vi.mock('../../backend/convex/_generated/api', () => ({
  api: {
    queries: {
      users: { getCurrUser: 'getCurrUser' },
      chatMessages: { getChatHistory: 'getChatHistory' },
    },
  },
}))

vi.mock('convex/react', () => ({
  useConvexAuth: vi.fn(),
  useQuery: vi.fn(),
}))

import { useConvexAuth, useQuery } from 'convex/react'

const mockUseConvexAuth = vi.mocked(useConvexAuth)
const mockUseQuery = vi.mocked(useQuery)

describe('App routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders landing page for unauthenticated users at root', async () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false, isLoading: false })
    mockUseQuery.mockReturnValue(undefined)

    renderWithProviders(<App />, { initialEntries: ['/'] })

    await waitFor(() => {
      expect(screen.getByText('Landing Page')).toBeInTheDocument()
    })
  })

  it('redirects unauthenticated users away from /dashboard to landing', async () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false, isLoading: false })
    mockUseQuery.mockReturnValue(undefined)

    renderWithProviders(<App />, { initialEntries: ['/dashboard'] })

    await waitFor(() => {
      expect(screen.getByText('Landing Page')).toBeInTheDocument()
    })
  })

  it('redirects unauthenticated users away from /onboarding to landing', async () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false, isLoading: false })
    mockUseQuery.mockReturnValue(undefined)

    renderWithProviders(<App />, { initialEntries: ['/onboarding'] })

    await waitFor(() => {
      expect(screen.getByText('Landing Page')).toBeInTheDocument()
    })
  })

  it('redirects authenticated user with complete profile to /dashboard', async () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseQuery.mockImplementation((...args: any[]) => args[0] === 'getChatHistory' ? [] : { onboardingComplete: true, name: 'Test User' })

    renderWithProviders(<App />, { initialEntries: ['/'] })

    await waitFor(() => {
      expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
    })
  })

  it('redirects authenticated user with incomplete profile to /onboarding', async () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseQuery.mockImplementation((...args: any[]) => args[0] === 'getChatHistory' ? [] : { onboardingComplete: false, name: 'Test User' })

    renderWithProviders(<App />, { initialEntries: ['/'] })

    await waitFor(() => {
      expect(screen.getByText('Onboarding Page')).toBeInTheDocument()
    })
  })

  it('renders dashboard for authenticated user with complete profile', async () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseQuery.mockImplementation((...args: any[]) => args[0] === 'getChatHistory' ? [] : { onboardingComplete: true, name: 'Test User' })

    renderWithProviders(<App />, { initialEntries: ['/dashboard'] })

    await waitFor(() => {
      expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
    })
  })

  it('renders profile page for authenticated user', async () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseQuery.mockImplementation((...args: any[]) => args[0] === 'getChatHistory' ? [] : { onboardingComplete: true, name: 'Test User' })

    renderWithProviders(<App />, { initialEntries: ['/profile'] })

    await waitFor(() => {
      expect(screen.getByText('Profile Page')).toBeInTheDocument()
    })
  })

  it('redirects unauthenticated users away from /schedule to landing', async () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false, isLoading: false })
    mockUseQuery.mockReturnValue(undefined)

    renderWithProviders(<App />, { initialEntries: ['/schedule'] })

    await waitFor(() => {
      expect(screen.getByText('Landing Page')).toBeInTheDocument()
    })
  })

  it('redirects unauthenticated users away from /preferences to landing', async () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false, isLoading: false })
    mockUseQuery.mockReturnValue(undefined)

    renderWithProviders(<App />, { initialEntries: ['/preferences'] })

    await waitFor(() => {
      expect(screen.getByText('Landing Page')).toBeInTheDocument()
    })
  })

  it('redirects unauthenticated users away from /classes to landing', async () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false, isLoading: false })
    mockUseQuery.mockReturnValue(undefined)

    renderWithProviders(<App />, { initialEntries: ['/classes'] })

    await waitFor(() => {
      expect(screen.getByText('Landing Page')).toBeInTheDocument()
    })
  })

  it('redirects unauthenticated users away from /syllabus-review to landing', async () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false, isLoading: false })
    mockUseQuery.mockReturnValue(undefined)

    renderWithProviders(<App />, { initialEntries: ['/syllabus-review'] })

    await waitFor(() => {
      expect(screen.getByText('Landing Page')).toBeInTheDocument()
    })
  })

  it('does not redirect while auth is still loading', async () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false, isLoading: true })
    mockUseQuery.mockReturnValue(undefined)

    renderWithProviders(<App />, { initialEntries: ['/dashboard'] })

    // Should still show the dashboard route (no redirect while loading)
    await waitFor(() => {
      expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
    })
  })
})
