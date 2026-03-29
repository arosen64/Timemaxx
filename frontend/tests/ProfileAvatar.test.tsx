import { render, screen } from '@testing-library/react'
import ProfileAvatar from '../src/components/profile/ProfileAvatar'

describe('ProfileAvatar', () => {
  it('renders loading skeleton when loading is true', () => {
    const { container } = render(<ProfileAvatar loading />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('does not render name or email text while loading', () => {
    render(<ProfileAvatar name="Maria Romo" email="maria@example.com" loading />)
    expect(screen.queryByText('Maria Romo')).not.toBeInTheDocument()
    expect(screen.queryByText('maria@example.com')).not.toBeInTheDocument()
  })

  it('renders the first initial of the name when no image is provided', () => {
    render(<ProfileAvatar name="Alex Johnson" email="alex@example.com" />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('falls back to "S" when name is undefined', () => {
    render(<ProfileAvatar email="test@example.com" />)
    expect(screen.getByText('S')).toBeInTheDocument()
  })

  it('renders an image with the provided src when image prop is given', () => {
    render(
      <ProfileAvatar
        name="Alex Johnson"
        email="alex@example.com"
        image="https://example.com/avatar.jpg"
      />,
    )
    const img = screen.getByRole('img', { name: /profile/i })
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg')
  })

  it('renders name and email text when not loading', () => {
    render(<ProfileAvatar name="Alex Johnson" email="alex@example.com" />)
    expect(screen.getByText('Alex Johnson')).toBeInTheDocument()
    expect(screen.getByText('alex@example.com')).toBeInTheDocument()
  })
})
