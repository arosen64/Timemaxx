import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useConvexAuth } from 'convex/react'
import { useEffect } from 'react'
import LandingPage from './pages/LandingPage'
import OnboardingPage from './pages/OnboardingPage'
import DashboardPage from './pages/DashboardPage'
import ProfilePage from './pages/ProfilePage'

const PROTECTED_ROUTES = ['/onboarding', '/dashboard', '/profile']

export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated && PROTECTED_ROUTES.includes(location.pathname)) {
      navigate('/')
    }
    if (isAuthenticated && location.pathname === '/') {
      navigate('/dashboard')
    }
  }, [isAuthenticated, isLoading, location.pathname])

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/profile" element={<ProfilePage />} />
    </Routes>
  )
}