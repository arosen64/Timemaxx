import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProfileForm from '../components/ProfileForm'
import WorkHoursSelector, { DEFAULT_WORK_HOURS } from '../components/WorkHoursSelector'
import PreferencesForm, { DEFAULT_PREFERENCES } from '../components/PreferencesForm'
import { ProfileData, WorkHoursData, PreferencesData } from '../types'

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
  const [preferences, setPreferences] = useState<PreferencesData>(DEFAULT_PREFERENCES)
  const [focusBlockError, setFocusBlockError] = useState<string | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validateStep1 = (): boolean => {
    const errors: { major?: string; year?: string } = {}
    if (!profile.major.trim()) errors.major = 'Major is required'
    if (!profile.year) errors.year = 'Please select your year'
    setProfileErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateStep3 = (): boolean => {
    if (preferences.focusBlockLength === '' || Number(preferences.focusBlockLength) <= 0) {
      setFocusBlockError('Please enter your preferred focus block length')
      return false
    }
    setFocusBlockError(undefined)
    return true
  }

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return
    setStep((s) => (s + 1) as Step)
  }

  const handleBack = () => {
    setStep((s) => (s - 1) as Step)
  }

  const handleSubmit = async () => {
    if (!validateStep3()) return
    setIsSubmitting(true)
    // TODO (issue #18): Replace with Convex mutation once schema is defined.
    // The mutation should save: profile, workHours, and preferences.
    navigate('/dashboard')
  }

  const isWide = step === 2 || step === 3

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

      {/* Form card */}
      <div className={`w-full rounded-2xl bg-white p-8 shadow-sm ${isWide ? 'max-w-2xl' : 'max-w-lg'}`}>
        {step === 1 && (
          <ProfileForm data={profile} onChange={setProfile} errors={profileErrors} />
        )}

        {step === 2 && (
          <WorkHoursSelector data={workHours} onChange={setWorkHours} />
        )}

        {step === 3 && (
          <PreferencesForm
            data={preferences}
            onChange={setPreferences}
            focusBlockError={focusBlockError}
          />
        )}

        {/* Navigation */}
        <div className="mt-8 flex justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1 || isSubmitting}
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
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : 'Submit'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
