import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from './utils'
import LandingPage from '../src/pages/LandingPage'

const mockSignIn = vi.fn().mockResolvedValue(undefined)

vi.mock('@convex-dev/auth/react', () => ({
  useAuthActions: () => ({ signIn: mockSignIn }),
}))

describe('LandingPage', () => {
  beforeEach(() => {
    mockSignIn.mockClear()
  })

  it('composes the hero panel and login card on the public root route', () => {
    renderWithProviders(<LandingPage />, { initialEntries: ['/'] })

    expect(screen.getByRole('heading', { level: 1, name: /study smarter/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /welcome back/i })).toBeInTheDocument()
  })

  it('uses a full-viewport layout wrapper', () => {
    const { container } = renderWithProviders(<LandingPage />, { initialEntries: ['/'] })
    const root = container.firstElementChild
    expect(root).toHaveClass('min-h-screen', 'flex', 'w-full')
  })

  it('initiates Google sign-in from the landing page without additional navigation', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LandingPage />, { initialEntries: ['/'] })

    await user.click(screen.getByRole('button', { name: /sign in with google/i }))

    expect(mockSignIn).toHaveBeenCalledWith('google')
  })
})
