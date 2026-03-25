import { Button } from '../ui'

interface OnboardingNavProps {
  onBack: () => void
  onContinue: () => void
  isFirstStep: boolean
  isLastStep: boolean
  continueLabel?: string
  disabled?: boolean
}

export default function OnboardingNav({
  onBack,
  onContinue,
  isFirstStep,
  isLastStep,
  continueLabel,
  disabled = false,
}: OnboardingNavProps) {
  const label = continueLabel ?? (isLastStep ? 'Finish' : 'Continue →')

  return (
    <div className={`mt-8 flex ${isFirstStep ? 'justify-end' : 'justify-between'}`}>
      {!isFirstStep && (
        <Button variant="ghost" size="nav" onClick={onBack} disabled={disabled}>
          Back
        </Button>
      )}
      <Button size="nav" onClick={onContinue} disabled={disabled}>
        {label}
      </Button>
    </div>
  )
}
