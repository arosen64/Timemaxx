import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { ProfileData, WorkHoursData, PreferencesData } from '../types'
import ProfileForm from '../components/ProfileForm'
import CoursesForm from '../components/CoursesForm'
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
    <OnboardingStepShell currentStep={step} totalSteps={4} wide={step === 2 || step === 3 || step === 4}>
      {step === 1 && (
        <ProfileForm data={profile} onChange={setProfile} errors={profileErrors} />
      )}
      {step === 2 && (
        <CoursesForm data={profile} onChange={setProfile} />
      )}
      {step === 3 && (
        <WorkHoursSelector data={workHours} onChange={setWorkHours} />
      )}
      {step === 4 && (
        <PreferencesForm data={preferences} onChange={setPreferences} />
      )}
      <OnboardingNav
        onBack={handleBack}
        onContinue={step < 4 ? handleNext : handleSubmit}
        isFirstStep={step === 1}
        isLastStep={step === 4}
        continueLabel={isSubmitting ? 'Saving...' : undefined}
        disabled={isSubmitting}
      />
    </OnboardingStepShell>
  )
}
