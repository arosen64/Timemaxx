import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import ProfileForm from '../components/ProfileForm'
import WorkHoursSelector, { DEFAULT_WORK_HOURS } from '../components/WorkHoursSelector'
import PreferencesForm, { DEFAULT_PREFERENCES } from '../components/PreferencesForm'
import { ProfileData, WorkHoursData, PreferencesData } from '../types'

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
  const isOnboardingComplete = useQuery(api.queries.users.isOnboardingComplete)
  const saveOnboarding = useMutation(api.mutations.users.completeOnboarding)
  const [step, setStep] = useState<Step>(1)
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE)
  const [profileErrors, setProfileErrors] = useState<{ major?: string; year?: string }>({})
  const [workHours, setWorkHours] = useState<WorkHoursData>(DEFAULT_WORK_HOURS)
  const [preferences, setPreferences] = useState<PreferencesData>(DEFAULT_PREFERENCES)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOnboardingComplete === true) navigate('/dashboard')
  }, [isOnboardingComplete, navigate])

  if (isOnboardingComplete === undefined) return null

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

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await saveOnboarding({
        major: profile.major,
        year: profile.year,
        difficultSubjects: profile.difficultSubjects,
        enjoyedSubjects: profile.enjoyedSubjects,
        courses: profile.courses,
        workHoursGrid: Object.entries(workHours).map(([day, slots]) => ({
          day,
          available: slots.available,
          blocked: slots.blocked,
        })),
        productivityTraits: preferences.traits,
        focusBlockLength: Number(preferences.focusBlockLength),
      })
      navigate('/dashboard')
    } catch {
      setIsSubmitting(false)
    }
  }

  const isWide = step === 2 || step === 3

  return (
    <div className="flex min-h-screen flex-col items-center bg-bg-gray px-4 py-12">
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
                      ? 'bg-teal text-white'
                      : isActive
                        ? 'bg-navy text-white'
                        : 'bg-border text-slate-blue'
                  }`}
                >
                  {isComplete ? '✓' : stepNum}
                </div>
                <span
                  className={`text-sm ${isActive ? 'font-semibold text-navy' : 'text-slate-blue'}`}
                >
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && <div className="mx-4 h-px w-12 bg-border" />}
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
          <PreferencesForm data={preferences} onChange={setPreferences} />
        )}

        {/* Navigation */}
        <div className="mt-8 flex justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1 || isSubmitting}
            className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-slate-blue hover:bg-bg-gray disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>
          {step < 3 ? (
            <button
              onClick={handleNext}
              className="rounded-lg bg-navy px-5 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-lg bg-navy px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : 'Submit'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
