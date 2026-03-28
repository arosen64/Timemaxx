import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useConvexAuth } from 'convex/react'
import { useEffect } from 'react'
import LandingPage from './pages/LandingPage'
import OnboardingPage from './pages/OnboardingPage'
import DashboardPage from './pages/DashboardPage'
import SchedulePage from './pages/SchedulePage'
import ProfilePage from './pages/ProfilePage'
import ClassesPage from './pages/ClassesPage'
import SyllabusReviewPage from './pages/SyllabusReviewPage'
import PreferencesPage from './pages/PreferencesPage'
import { useQuery } from "convex/react";
import { api } from "../../backend/convex/_generated/api";

const PUBLIC_ROUTES = ['/']

export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const user = useQuery(api.queries.users.getCurrUser);
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (isLoading) return

    // After a Google Calendar OAuth redirect, the callback lands on /profile.
    // Check localStorage before the unauthenticated guard fires so the race
    // condition (auth state briefly unresolved on full-page reload) cannot
    // redirect the user to / before we have a chance to navigate back.
    if (location.pathname === '/profile') {
      try {
        const saved = localStorage.getItem('timemaxx_onboarding_state')
        if (saved) {
          const { returnTo } = JSON.parse(saved) as { returnTo?: string }
          if (returnTo) {
            navigate(returnTo, { replace: true })
            return
          }
        }
      } catch {
        // localStorage unavailable — continue with normal routing
      }
    }

    if (!isAuthenticated && !PUBLIC_ROUTES.includes(location.pathname)) {
      navigate('/')
    }
    if (isAuthenticated && location.pathname === '/') {
      if (user === undefined) return
      if (user?.onboardingComplete) {
        navigate('/dashboard')
      } else {
        navigate('/onboarding')
      }
    }
  }, [isAuthenticated, isLoading, location.pathname, user])

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/schedule" element={<SchedulePage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/preferences" element={<PreferencesPage />} />
      <Route path="/classes" element={<ClassesPage />} />

      <Route path="/syllabus-review" element={<SyllabusReviewPage />} />
    </Routes>
  )
}