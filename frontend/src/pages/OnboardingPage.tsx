import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useAction } from 'convex/react'
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
  const calendarStatus = useQuery(api.queries.calendar.getCalendarConnectionStatus)
  const initiateCalendarOAuth = useAction(api.actions.initiateGoogleCalendarOAuth.initiateGoogleCalendarOAuth)
  const [step, setStep] = useState<Step>(1)
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE)
  const [profileErrors, setProfileErrors] = useState<{ major?: string; year?: string }>({})
  const [workHours, setWorkHours] = useState<WorkHoursData>(DEFAULT_WORK_HOURS)
  const [preferences, setPreferences] = useState<PreferencesData>(DEFAULT_PREFERENCES)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleConnectCalendar() {
    const authUrl = await initiateCalendarOAuth({})
    window.location.href = authUrl
  }

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
          <PreferencesForm data={preferences} onChange={setPreferences} />
        )}

        {/* Google Calendar (optional) — shown on final step */}
        {step === 3 && (
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="flex flex-col gap-1">
              <span className="font-heading text-sm font-semibold text-navy">Google Calendar (optional)</span>
              <span className="font-body text-xs text-slate-blue">Connect to schedule around your existing events</span>
            </div>
            {calendarStatus?.connected ? (
              <span className="font-heading text-sm font-semibold text-teal">Connected</span>
            ) : (
              <button
                onClick={handleConnectCalendar}
                className="flex items-center justify-center h-12 px-6 font-heading text-sm font-semibold text-navy bg-white border border-border rounded-lg transition hover:opacity-90"
              >
                Connect
              </button>
            )}
          </div>
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
