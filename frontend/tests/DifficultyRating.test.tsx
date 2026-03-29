import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DifficultyRating from '../src/components/DifficultyRating'

describe('DifficultyRating', () => {
  it('renders buttons 1 through 5', () => {
    render(<DifficultyRating value={3} onChange={vi.fn()} />)
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByRole('button', { name: String(i) })).toBeInTheDocument()
    }
  })

  it('calls onChange with the clicked value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DifficultyRating value={3} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '5' }))

    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('highlights the active value button', () => {
    render(<DifficultyRating value={2} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '2' })).toHaveClass('bg-navy')
  })

  it('does not highlight inactive buttons', () => {
    render(<DifficultyRating value={2} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '4' })).not.toHaveClass('bg-navy')
  })
})
