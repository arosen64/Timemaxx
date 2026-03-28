import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DeleteAccountModal from '../src/components/profile/DeleteAccountModal'

describe('DeleteAccountModal', () => {
  it('does not render when isOpen is false', () => {
    render(<DeleteAccountModal isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders when isOpen is true', () => {
    render(<DeleteAccountModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders the title and warning text', () => {
    render(<DeleteAccountModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/delete account\?/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/permanently deleted/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/this cannot be undone/i)).toBeInTheDocument()
  })

  it('renders Cancel and Delete Account buttons', () => {
    render(<DeleteAccountModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /delete account/i })).toBeInTheDocument()
  })

  it('calls onConfirm then onClose when Delete Account is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<DeleteAccountModal isOpen onClose={onClose} onConfirm={onConfirm} />)

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /delete account/i }))

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<DeleteAccountModal isOpen onClose={onClose} onConfirm={vi.fn()} />)

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
