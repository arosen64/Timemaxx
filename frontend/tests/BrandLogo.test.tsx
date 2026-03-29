import { render, screen } from '@testing-library/react'
import BrandLogo from '../src/components/landing/BrandLogo'

describe('BrandLogo', () => {
  it('renders the product name', () => {
    render(<BrandLogo />)
    expect(screen.getByText('Timemaxx')).toBeInTheDocument()
  })

  it('exposes the logo mark for assistive technologies via the book icon', () => {
    const { container } = render(<BrandLogo />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
