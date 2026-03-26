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

type Step = 1 | 2 | 3

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

  return (
    <OnboardingStepShell currentStep={step} totalSteps={3} wide={step === 2 || step === 3}>
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
        <div className="flex items-center justify-between rounded-lg border border-border p-4 mt-6">
          <div className="flex flex-col gap-1">
            <span className="font-heading text-sm font-semibold text-navy">Google Calendar (optional)</span>
            <span className="font-body text-xs text-slate-blue">Connect to schedule around your existing events</span>
          </div>
          {calendarStatus?.connected ? (
            <span className="font-heading text-sm font-semibold text-teal">Connected</span>
          ) : (
            <button
              onClick={handleConnectCalendar}
              className="flex items-center justify-center h-10 px-5 font-heading text-sm font-semibold text-navy bg-white border border-border rounded-lg transition hover:opacity-90"
            >
              Connect
            </button>
          )}
        </div>
      )}

      <OnboardingNav
        onBack={handleBack}
        onContinue={step < 3 ? handleNext : handleSubmit}
        isFirstStep={step === 1}
        isLastStep={step === 3}
        continueLabel={isSubmitting ? 'Saving...' : undefined}
        disabled={isSubmitting}
      />
    </OnboardingStepShell>
  )
}
