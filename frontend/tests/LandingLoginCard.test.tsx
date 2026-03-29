import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from './utils'
import LandingLoginCard from '../src/components/landing/LandingLoginCard'

const mockSignIn = vi.fn().mockResolvedValue(undefined)

vi.mock('@convex-dev/auth/react', () => ({
  useAuthActions: () => ({ signIn: mockSignIn }),
}))

describe('LandingLoginCard', () => {
  beforeEach(() => {
    mockSignIn.mockClear()
  })

  it('renders welcome copy and legal notice', () => {
    renderWithProviders(<LandingLoginCard />)
    expect(screen.getByRole('heading', { level: 2, name: /welcome back/i })).toBeInTheDocument()
    expect(
      screen.getByText(/Sign in to access your personalized study dashboard/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/Terms of Service and Privacy Policy/i)).toBeInTheDocument()
  })

  it('calls signIn with "google" when the user clicks Sign in with Google', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LandingLoginCard />)

    await user.click(screen.getByRole('button', { name: /sign in with google/i }))

    expect(mockSignIn).toHaveBeenCalledTimes(1)
    expect(mockSignIn).toHaveBeenCalledWith('google')
  })
})
