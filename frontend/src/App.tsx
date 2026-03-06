import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useConvexAuth } from 'convex/react'
import { useEffect } from 'react'
import LandingPage from './pages/LandingPage'
import OnboardingPage from './pages/OnboardingPage'
import DashboardPage from './pages/DashboardPage'
import ProfilePage from './pages/ProfilePage'
import { useQuery } from "convex/react";
import { api } from "../../backend/convex/_generated/api";

const PROTECTED_ROUTES = ['/onboarding', '/dashboard', '/profile']

export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const user = useQuery(api.queries.users.getCurrUser);
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated && PROTECTED_ROUTES.includes(location.pathname)) {
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
      <Route path="/profile" element={<ProfilePage />} />
    </Routes>
  )
}