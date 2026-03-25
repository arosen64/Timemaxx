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
        <button
          type="button"
          onClick={onBack}
          disabled={disabled}
          className="rounded-lg border border-border px-5 py-2 font-heading text-sm font-medium text-slate-blue transition hover:bg-bg-gray disabled:cursor-not-allowed disabled:opacity-50"
        >
          Back
        </button>
      )}
      <button
        type="button"
        onClick={onContinue}
        disabled={disabled}
        className="rounded-lg bg-navy px-5 py-2 font-heading text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {label}
      </button>
    </div>
  )
}
