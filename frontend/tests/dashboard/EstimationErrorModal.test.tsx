import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../utils'
import EstimationErrorModal from '../../src/components/dashboard/EstimationErrorModal'

const DEFAULT_PROPS = {
  isOpen: true,
  message: 'Unable to estimate task time.',
  onClose: vi.fn(),
  onRetry: vi.fn(),
}

describe('EstimationErrorModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders "Estimation Failed" title when open', () => {
    renderWithProviders(<EstimationErrorModal {...DEFAULT_PROPS} />)
    expect(screen.getByRole('dialog', { name: 'Estimation Failed modal' })).toBeInTheDocument()
    expect(screen.getByText('Estimation Failed')).toBeInTheDocument()
  })

  it('renders the message text', () => {
    renderWithProviders(<EstimationErrorModal {...DEFAULT_PROPS} />)
    expect(screen.getByText('Unable to estimate task time.')).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    renderWithProviders(<EstimationErrorModal {...DEFAULT_PROPS} isOpen={false} />)
    expect(screen.queryByRole('dialog', { name: 'Estimation Failed modal' })).toBeNull()
  })

  it('calls onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<EstimationErrorModal {...DEFAULT_PROPS} />)
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(DEFAULT_PROPS.onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onRetry when Retry button is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<EstimationErrorModal {...DEFAULT_PROPS} />)
    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(DEFAULT_PROPS.onRetry).toHaveBeenCalledTimes(1)
  })
})
