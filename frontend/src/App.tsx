import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import { useEffect } from "react";
import LandingPage from "./pages/LandingPage";
import OnboardingPage from "./pages/OnboardingPage";
import DashboardPage from "./pages/DashboardPage";
import SchedulePage from "./pages/SchedulePage";
import ProfilePage from "./pages/ProfilePage";
import ClassesPage from "./pages/ClassesPage";
import SyllabusReviewPage from "./pages/SyllabusReviewPage";
import PreferencesPage from "./pages/PreferencesPage";
import AppLayout from "./components/AppLayout";
import { useQuery } from "convex/react";
import { api } from "../../backend/convex/_generated/api";

const PUBLIC_ROUTES = ["/"];

export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(api.queries.users.getCurrUser);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;

    // After a Google Calendar OAuth redirect, return target can come from:
    // 1) localStorage (onboarding flow stores /onboarding), or
    // 2) query param set by callback fallback (defaults to /profile).
    // Handle this before auth guards to avoid navigation races on reload.
    if (isAuthenticated) {
      let targetFromState: string | undefined;
      try {
        const saved = localStorage.getItem("timemaxx_onboarding_state");
        if (saved) {
          const { returnTo } = JSON.parse(saved) as { returnTo?: string };
          if (returnTo) {
            targetFromState = returnTo;
          }
        }
      } catch {
        // localStorage unavailable — continue with normal routing
      }

      const searchParams = new URLSearchParams(location.search);
      const queryReturnTo = searchParams.get("returnTo") ?? undefined;
      const target = targetFromState ?? queryReturnTo;
      if (target && target.startsWith("/")) {
        try {
          localStorage.removeItem("timemaxx_onboarding_state");
        } catch {
          /* unavailable */
        }
        navigate(target, { replace: true });
        return;
      }
    }

    if (!isAuthenticated && !PUBLIC_ROUTES.includes(location.pathname)) {
      navigate("/");
    }
    if (isAuthenticated && location.pathname === "/") {
      if (user === undefined) return;
      if (user?.onboardingComplete) {
        navigate("/dashboard");
      } else {
        navigate("/onboarding");
      }
    }
  }, [isAuthenticated, isLoading, location.pathname, location.search, navigate, user]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/syllabus-review" element={<SyllabusReviewPage />} />
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/preferences" element={<PreferencesPage />} />
        <Route path="/classes" element={<ClassesPage />} />
      </Route>
    </Routes>
  );
}
