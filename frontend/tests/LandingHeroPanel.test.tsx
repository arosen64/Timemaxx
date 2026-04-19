import { render, screen } from '@testing-library/react'
import LandingHeroPanel from '../src/components/landing/LandingHeroPanel'

describe('LandingHeroPanel', () => {
  it('renders the headline and supporting copy', () => {
    render(<LandingHeroPanel />)
    expect(screen.getByRole('heading', { level: 1, name: /study smarter/i })).toBeInTheDocument()
    expect(
      screen.getByText(/AI-powered scheduling that estimates your task time/i),
    ).toBeInTheDocument()
  })

  it('lists the product feature bullets', () => {
    render(<LandingHeroPanel />)
    expect(screen.getByText('AI-powered time estimation')).toBeInTheDocument()
    expect(screen.getByText('Personalized daily study windows')).toBeInTheDocument()
    expect(screen.getByText('Smart scheduling around your life')).toBeInTheDocument()
  })

  it('shows university branding', () => {
    render(<LandingHeroPanel />)
    expect(screen.getByText(/Johns Hopkins University/i)).toBeInTheDocument()
    expect(screen.getByText('Timemaxx')).toBeInTheDocument()
  })

  it('uses a full-height column layout region', () => {
    const { container } = render(<LandingHeroPanel />)
    const root = container.firstElementChild
    expect(root).toHaveClass('flex', 'flex-col', 'justify-between', 'bg-navy')
  })
})
