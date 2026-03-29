import { screen } from '@testing-library/react'
import { renderWithProviders } from '../utils'
import StatCard from '../../src/components/dashboard/StatCard'

const INDICATOR = {
  dotClass: 'bg-teal',
  text: 'On track',
  textClass: 'text-teal',
}

describe('StatCard', () => {
  it('renders the label, value, and indicator text', () => {
    const { container } = renderWithProviders(
      <StatCard label="Tasks This Week" value={5} indicator={INDICATOR} />
    )
    expect(screen.getByText('Tasks This Week')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('On track')).toBeInTheDocument()
  })

  it('renders a string value', () => {
    renderWithProviders(
      <StatCard label="Estimated Time" value="1h 30m" indicator={INDICATOR} />
    )
    expect(screen.getByText('1h 30m')).toBeInTheDocument()
  })

  it('applies dark variant: container firstChild has class bg-navy', () => {
    const { container } = renderWithProviders(
      <StatCard label="Tasks This Week" value={3} indicator={INDICATOR} variant="dark" />
    )
    expect(container.firstChild).toHaveClass('bg-navy')
  })

  it('applies default variant: container firstChild has class bg-white', () => {
    const { container } = renderWithProviders(
      <StatCard label="Tasks This Week" value={3} indicator={INDICATOR} variant="default" />
    )
    expect(container.firstChild).toHaveClass('bg-white')
  })
})
