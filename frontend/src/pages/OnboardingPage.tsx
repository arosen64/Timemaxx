import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { ProfileData, WorkHoursData, PreferencesData } from '../types'
import {
  ProfileForm,
  WorkHoursSelector,
  DEFAULT_WORK_HOURS,
  PreferencesForm,
  DEFAULT_PREFERENCES,
  OnboardingStepShell,
  OnboardingNav,
} from '../components/onboarding'

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
