import { useAuthActions } from "@convex-dev/auth/react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../backend/convex/_generated/api";

export default function ProfilePage() {
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const user = useQuery(api.queries.users.getCurrUser);
  const calendarStatus = useQuery(api.queries.calendar.getCalendarConnectionStatus);
  const deleteCalendarToken = useMutation(api.mutations.calendar.deleteCalendarToken);
  const initiateCalendarOAuth = useAction(api.actions.initiateGoogleCalendarOAuth.initiateGoogleCalendarOAuth);

  async function handleConnectCalendar() {
    const authUrl = await initiateCalendarOAuth({});
    window.location.href = authUrl;
  }

  async function handleRevokeCalendar() {
    await deleteCalendarToken({});
  }

  async function handleLogout() {
    await signOut();
    navigate("/");
  }

  return (
    <div className="flex h-screen font-body bg-bg-gray">
      <Sidebar />

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-y-auto gap-8 p-10">
        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-bold text-navy">Profile</h1>
          <p className="font-body text-sm text-slate-blue">Manage your account settings</p>
        </div>

        {/* Profile Card */}
        <div className="flex flex-col gap-8 p-12 bg-white border border-border rounded-xl">
          {/* Avatar Row */}
          <div className="flex items-center gap-5">
            {user === undefined ? (
              <div className="flex-shrink-0 h-[72px] w-[72px] bg-border rounded-full animate-pulse" />
            ) : user?.image ? (
              <img src={user.image} alt="Profile" referrerPolicy="no-referrer" className="flex-shrink-0 h-[72px] w-[72px] rounded-full object-cover" />
            ) : (
              <div className="flex flex-shrink-0 items-center justify-center h-[72px] w-[72px] bg-sky-blue rounded-full">
                <span className="font-heading text-2xl font-bold text-navy">
                  {user?.name?.charAt(0).toUpperCase() ?? "S"}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-1">
              {user === undefined ? (
                <>
                  <div className="h-7 w-40 bg-border rounded animate-pulse" />
                  <div className="h-4 w-52 bg-border rounded animate-pulse" />
                </>
              ) : (
                <>
                  <span className="font-heading text-2xl font-bold text-navy">{user?.name}</span>
                  <span className="font-body text-sm text-slate-blue">{user?.email}</span>
                </>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-border" />

          {/* Fields Row 1 */}
          <div className="flex w-full gap-8">
            <div className="flex flex-1 flex-col gap-1.5">
              {user === undefined ? (
                <>
                  <div className="h-3 w-16 bg-border rounded animate-pulse" />
                  <div className="h-5 w-36 bg-border rounded animate-pulse" />
                </>
              ) : (
                <>
                  <span className="font-body text-xs font-semibold text-slate-blue">Full Name</span>
                  <span className="font-heading text-base font-medium text-navy">{user?.name}</span>
                </>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              {user === undefined ? (
                <>
                  <div className="h-3 w-10 bg-border rounded animate-pulse" />
                  <div className="h-5 w-48 bg-border rounded animate-pulse" />
                </>
              ) : (
                <>
                  <span className="font-body text-xs font-semibold text-slate-blue">Email</span>
                  <span className="font-heading text-base font-medium text-navy">{user?.email}</span>
                </>
              )}
            </div>
          </div>

          {/* Fields Row 2 */}
          {user === undefined ? (
            <div className="flex w-full gap-8">
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="h-3 w-12 bg-border rounded animate-pulse" />
                <div className="h-5 w-32 bg-border rounded animate-pulse" />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="h-3 w-8 bg-border rounded animate-pulse" />
                <div className="h-5 w-24 bg-border rounded animate-pulse" />
              </div>
            </div>
          ) : user?.onboardingComplete ? (
            <div className="flex w-full gap-8">
              <div className="flex flex-1 flex-col gap-1.5">
                <span className="font-body text-xs font-semibold text-slate-blue">Major</span>
                <span className="font-heading text-base font-medium text-navy">{user?.major}</span>
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <span className="font-body text-xs font-semibold text-slate-blue">Year</span>
                <span className="font-heading text-base font-medium text-navy">{user?.year}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="font-body text-sm text-slate-blue">Complete your onboarding survey to fill in your academic details.</p>
              <button
                onClick={() => navigate("/onboarding")}
                className="flex items-center justify-center h-11 w-56 font-heading text-sm font-semibold text-white bg-navy rounded-lg transition hover:opacity-90"
              >
                Complete Onboarding Survey
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="h-px w-full bg-border" />

          {/* Google Calendar */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="font-heading text-base font-semibold text-navy">Google Calendar</span>
              <span className="font-body text-sm text-slate-blue">Connect to improve schedule accuracy</span>
            </div>
            {calendarStatus?.connected ? (
              <button
                onClick={handleRevokeCalendar}
                className="flex items-center justify-center h-11 gap-2 px-5 font-heading text-sm font-semibold text-white bg-urgent-red rounded-lg transition hover:opacity-90"
              >
                Revoke Access
              </button>
            ) : (
              <button
                onClick={handleConnectCalendar}
                className="flex items-center justify-center h-11 gap-2 px-5 font-heading text-sm font-semibold text-white bg-navy rounded-lg transition hover:opacity-90"
              >
                <CalendarIcon />
                Connect Calendar
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-border" />

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center justify-center h-11 w-40 gap-2 font-heading text-sm font-semibold text-white bg-dark-red rounded-lg transition hover:opacity-90"
          >
            <LogoutIcon />
            Log Out
          </button>
        </div>
      </main>
    </div>
  );
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
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
