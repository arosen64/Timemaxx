import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useConvexAuth } from 'convex/react'
import { useEffect } from 'react'
import LandingPage from './pages/LandingPage'
import OnboardingPage from './pages/OnboardingPage'
import DashboardPage from './pages/DashboardPage'
import ProfilePage from './pages/ProfilePage'
import ClassesPage from './pages/ClassesPage'
import SyllabusReviewPage from './pages/SyllabusReviewPage'
import { useQuery } from "convex/react";
import { api } from "../../backend/convex/_generated/api";

const PROTECTED_ROUTES = ['/onboarding', '/dashboard', '/profile', '/classes']

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
      <Route path="/classes" element={<ClassesPage />} />

      {/**FOR TESTING ONLY */}
      <Route path="/syllabus-review" element={
        <SyllabusReviewPage
          course={{ title: 'Data Structures', courseCode: 'EN.601.226', term: 'Fall 2025' }}
          tasks={[
            { title: 'Problem Set 1', description: 'Solve exercises 1-10 from chapter 3.', dueDate: new Date('2025-09-15').getTime(), taskType: 'Problem Set' },
            { title: 'Midterm Exam', description: 'Covers all topics from weeks 1-7.', dueDate: new Date('2025-10-20').getTime(), taskType: 'Exam Prep' },
            { title: 'Final Project', description: 'Build a full-stack application.', dueDate: new Date('2025-12-10').getTime(), taskType: 'Coding' },
          ]}
          onDone={() => {}}
          onCancel={() => {}}
        />
      } />
    </Routes>
  )
}