import { ReactNode } from 'react'
import { BrandLogo } from '../ui'

interface OnboardingStepShellProps {
  currentStep: number
  totalSteps: number
  wide?: boolean
  children: ReactNode
}

export default function OnboardingStepShell({
  currentStep,
  totalSteps,
  wide = false,
  children,
}: OnboardingStepShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-bg-gray">
      <header className="flex h-16 w-full flex-shrink-0 items-center justify-between bg-navy px-10">
        <BrandLogo size="sm" />

        <div className="flex items-center gap-2">
          {Array.from({ length: totalSteps }, (_, i) => {
            const stepNum = i + 1
            const isActive = currentStep === stepNum
            const isComplete = currentStep > stepNum
            return (
              <div
                key={stepNum}
                className={`h-1.5 w-8 rounded-full ${
                  isComplete || isActive ? 'bg-teal' : 'bg-sky-blue/40'
                }`}
              />
            )
          })}
        </div>

        <span className="font-body text-sm text-sky-blue">
          Step {currentStep} of {totalSteps}
        </span>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div
          className={`w-full rounded-xl border border-border bg-white p-12 ${
            wide ? 'max-w-2xl' : 'max-w-xl'
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
