import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProfileForm from '../components/ProfileForm'
import WorkHoursSelector, { DEFAULT_WORK_HOURS } from '../components/WorkHoursSelector'
import { ProfileData, WorkHoursData } from '../types'

// TODO (issue #18 + #45): After schema is defined, add a Convex query here to check
// if the current user already has a profile, and redirect to /dashboard if so.

type Step = 1 | 2 | 3

const STEP_LABELS = ['Profile', 'Work Hours', 'Preferences']

const DEFAULT_PROFILE: ProfileData = {
  major: '',
  year: '',
  difficultSubjects: [],
  enjoyedSubjects: [],
  courses: [],
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE)
  const [profileErrors, setProfileErrors] = useState<{ major?: string; year?: string }>({})
  const [workHours, setWorkHours] = useState<WorkHoursData>(DEFAULT_WORK_HOURS)

  // preferencesData state will be added in issue #23

  const validateStep1 = (): boolean => {
    const errors: { major?: string; year?: string } = {}
    if (!profile.major.trim()) errors.major = 'Major is required'
    if (!profile.year) errors.year = 'Please select your year'
    setProfileErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return
    setStep((s) => (s + 1) as Step)
  }

  const handleBack = () => {
    setStep((s) => (s - 1) as Step)
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 px-4 py-12">
      {/* Step indicator */}
      <div className="mb-10 flex items-center">
        {STEP_LABELS.map((label, i) => {
          const stepNum = (i + 1) as Step
          const isActive = step === stepNum
          const isComplete = step > stepNum
          return (
            <div key={label} className="flex items-center">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    isComplete
                      ? 'bg-green-500 text-white'
                      : isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isComplete ? '✓' : stepNum}
                </div>
                <span
                  className={`text-sm ${isActive ? 'font-semibold text-gray-900' : 'text-gray-400'}`}
                >
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && <div className="mx-4 h-px w-12 bg-gray-300" />}
            </div>
          )
        })}
      </div>

      {/* Form card — wider on step 2 to accommodate the grid */}
      <div className={`w-full rounded-2xl bg-white p-8 shadow-sm ${step === 2 ? 'max-w-2xl' : 'max-w-lg'}`}>
        {step === 1 && (
          <ProfileForm data={profile} onChange={setProfile} errors={profileErrors} />
        )}

        {step === 2 && (
          <WorkHoursSelector data={workHours} onChange={setWorkHours} />
        )}

        {/* Placeholder for issue #23 */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-gray-900">Productivity Preferences</h2>
            <p className="text-sm text-gray-500">Coming soon — see issue #23.</p>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>
          {step < 3 ? (
            <button
              onClick={handleNext}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Next
            </button>
          ) : (
            <button
              onClick={() => {
                // TODO (issue #23): call Convex mutation to save all onboarding data
                navigate('/dashboard')
              }}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Submit
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
