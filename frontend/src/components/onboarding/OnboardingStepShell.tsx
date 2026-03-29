import { ReactNode } from 'react'
import { BookOpenIcon } from '../icons'

interface OnboardingStepShellProps {
  currentStep: number
  totalSteps: number
  wide?: boolean
  tall?: boolean
  children: ReactNode
}

export default function OnboardingStepShell({
  currentStep,
  totalSteps,
  wide = false,
  tall = false,
  children,
}: OnboardingStepShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-bg-gray">
      <header className="flex h-16 w-full flex-shrink-0 items-center justify-between bg-navy px-10">
        {/* Brand logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-teal text-navy">
            <BookOpenIcon size={18} />
          </div>
          <span className="font-heading text-lg font-bold text-white">Timemaxx</span>
        </div>

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

      <div className={`flex flex-1 flex-col items-center px-4 py-12 ${tall ? '' : 'justify-center'}`}>
        <div
          className={`flex w-full flex-col rounded-xl border border-border bg-white p-12 ${
            wide || tall ? 'max-w-2xl' : 'max-w-xl'
          } ${tall ? 'flex-1' : ''}`}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
