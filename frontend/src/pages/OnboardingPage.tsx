import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { ProfileData, WorkHoursData, PreferencesData } from '../types'
import ProfileForm from '../components/ProfileForm'
import WorkHoursSelector, { DEFAULT_WORK_HOURS } from '../components/WorkHoursSelector'
import PreferencesForm, { DEFAULT_PREFERENCES } from '../components/PreferencesForm'
import OnboardingStepShell from '../components/onboarding/OnboardingStepShell'
import OnboardingNav from '../components/onboarding/OnboardingNav'

type Step = 1 | 2 | 3 | 4

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

  const [step, setStep] = useState<Step>(() => {
    const saved = localStorage.getItem('timemaxx_onboarding_state')
    if (saved) {
      localStorage.removeItem('timemaxx_onboarding_state')
      return 4
    }
    return 1
  })
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE)
  const [profileErrors, setProfileErrors] = useState<{ major?: string; year?: string }>({})
  const [workHours, setWorkHours] = useState<WorkHoursData>(DEFAULT_WORK_HOURS)
  const [preferences, setPreferences] = useState<PreferencesData>(DEFAULT_PREFERENCES)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleConnectCalendar() {
    localStorage.setItem('timemaxx_onboarding_state', JSON.stringify({ returnTo: '/onboarding' }))
    const authUrl = await initiateCalendarOAuth({})
    window.location.href = authUrl
  }

  useEffect(() => {
    if (isOnboardingComplete === true && step < 4) navigate('/dashboard')
  }, [isOnboardingComplete, navigate, step])

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

  const handleSaveAndContinue = async () => {
    setIsSubmitting(true)
    try {
      await saveOnboarding({
        major: profile.major,
        year: profile.year,
        difficultSubjects: profile.difficultSubjects,
        enjoyedSubjects: profile.enjoyedSubjects,
        workHoursGrid: Object.entries(workHours).map(([day, slots]) => ({
          day,
          available: slots.available,
          blocked: slots.blocked,
        })),
        productivityTraits: preferences.traits,
        focusBlockLength: Number(preferences.focusBlockLength),
      })
      setStep(4)
    } catch {
      // keep submitting false so user can retry
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <OnboardingStepShell currentStep={step} totalSteps={4} wide={step === 2 || step === 3}>
      {step === 1 && (
        <ProfileForm data={profile} onChange={setProfile} errors={profileErrors} />
      )}
      {step === 2 && (
        <WorkHoursSelector data={workHours} onChange={setWorkHours} />
      )}
      {step === 3 && (
        <PreferencesForm data={preferences} onChange={setPreferences} />
      )}
      {step === 4 && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-2xl font-bold text-navy">Connect Google Calendar</h2>
            <p className="font-body text-sm text-slate-blue">Optionally sync your calendar so Timemaxx can schedule around your existing events.</p>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="font-heading text-sm font-semibold text-navy">Google Calendar (optional)</span>
                <span className="font-body text-xs text-slate-blue">Connect to schedule around your existing events</span>
              </div>
              {calendarStatus?.connected ? (
                <span className="flex items-center gap-1.5 font-heading text-sm font-semibold text-teal">
                  <CalendarIcon />
                  Connected
                </span>
              ) : (
                <button
                  onClick={handleConnectCalendar}
                  className="flex items-center justify-center h-10 px-5 font-heading text-sm font-semibold text-navy bg-white border border-border rounded-lg transition hover:opacity-90"
                >
                  Connect
                </button>
              )}
            </div>
            {calendarStatus?.connected && (
              <span className="font-body text-xs text-slate-blue">You can undo this on the Profile page.</span>
            )}
          </div>
        </div>
      )}

      <OnboardingNav
        onBack={handleBack}
        onContinue={step < 3 ? handleNext : step === 3 ? handleSaveAndContinue : () => navigate('/dashboard')}
        isFirstStep={step === 1}
        isLastStep={step === 4}
        continueLabel={isSubmitting ? 'Saving...' : undefined}
        disabled={isSubmitting}
      />
    </OnboardingStepShell>
  )
}

function CalendarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="stroke-teal"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}
