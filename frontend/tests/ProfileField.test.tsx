import { render, screen } from '@testing-library/react'
import ProfileField from '../src/components/profile/ProfileField'

describe('ProfileField', () => {
  it('renders loading skeleton and hides label when loading is true', () => {
    const { container } = render(<ProfileField label="Major" loading />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    expect(screen.queryByText('Major')).not.toBeInTheDocument()
  })

  it('renders label and value when not loading', () => {
    render(<ProfileField label="Major" value="Computer Science" />)
    expect(screen.getByText('Major')).toBeInTheDocument()
    expect(screen.getByText('Computer Science')).toBeInTheDocument()
  })

  it('renders label without a value when value is not provided', () => {
    render(<ProfileField label="Year" />)
    expect(screen.getByText('Year')).toBeInTheDocument()
  })
})
