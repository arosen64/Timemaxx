import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { ProfileData, WorkHoursData, PreferencesData } from '../types'
import { Button, BrandLogo } from '../components/ui'
import { ProfileForm, WorkHoursSelector, DEFAULT_WORK_HOURS, PreferencesForm, DEFAULT_PREFERENCES } from '../components/onboarding'

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
    <div className="flex min-h-screen flex-col bg-bg-gray">
      {/* Top bar */}
      <header className="flex h-16 w-full flex-shrink-0 items-center justify-between bg-navy px-10">
        <BrandLogo size="sm" />

        {/* Step pills */}
        <div className="flex items-center gap-2">
          {STEP_LABELS.map((_, i) => {
            const stepNum = (i + 1) as Step
            const isActive = step === stepNum
            const isComplete = step > stepNum
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

        <span className="font-body text-sm text-sky-blue">Step {step} of 3</span>
      </header>

      {/* Content */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className={`w-full rounded-xl border border-border bg-white p-12 ${isWide ? 'max-w-2xl' : 'max-w-xl'}`}>
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
          <div className={`mt-8 flex ${step === 1 ? 'justify-end' : 'justify-between'}`}>
            {step > 1 && (
              <Button variant="ghost" size="nav" onClick={handleBack} disabled={isSubmitting}>
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button size="nav" onClick={handleNext}>
                Continue
              </Button>
            ) : (
              <Button size="nav" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Finish'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
