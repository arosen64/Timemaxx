import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OnboardingNav from '../src/components/onboarding/OnboardingNav'

function setup(props: {
  isFirstStep?: boolean
  isLastStep?: boolean
  continueLabel?: string
  disabled?: boolean
} = {}) {
  const onBack = vi.fn()
  const onContinue = vi.fn()
  render(
    <OnboardingNav
      onBack={onBack}
      onContinue={onContinue}
      isFirstStep={false}
      isLastStep={false}
      {...props}
    />
  )
  return { onBack, onContinue }
}

describe('OnboardingNav', () => {
  it('hides Back button on first step', () => {
    setup({ isFirstStep: true })
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
  })

  it('shows Back button on non-first steps', () => {
    setup({ isFirstStep: false })
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
  })

  it('shows "Continue →" by default', () => {
    setup({ isLastStep: false })
    expect(screen.getByRole('button', { name: 'Continue →' })).toBeInTheDocument()
  })

  it('shows "Finish" on last step', () => {
    setup({ isLastStep: true })
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument()
  })

  it('uses custom continueLabel when provided', () => {
    setup({ continueLabel: 'Save & Continue' })
    expect(screen.getByRole('button', { name: 'Save & Continue' })).toBeInTheDocument()
  })

  it('calls onBack when Back is clicked', async () => {
    const user = userEvent.setup()
    const { onBack } = setup({ isFirstStep: false })

    await user.click(screen.getByRole('button', { name: /back/i }))

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('calls onContinue when Continue is clicked', async () => {
    const user = userEvent.setup()
    const { onContinue } = setup()

    await user.click(screen.getByRole('button', { name: 'Continue →' }))

    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('disables both buttons when disabled prop is true', () => {
    setup({ isFirstStep: false, disabled: true })
    expect(screen.getByRole('button', { name: /back/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Continue →' })).toBeDisabled()
  })
})
