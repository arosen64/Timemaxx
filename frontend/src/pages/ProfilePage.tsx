import { useAuthActions } from "@convex-dev/auth/react";
import { Link, useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const { signOut } = useAuthActions();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate("/");
  }

  return (
    <div className="flex h-screen font-body bg-bg-gray">
      {/* Sidebar */}
      <aside className="flex flex-shrink-0 flex-col justify-between h-full w-64 py-8 px-6 bg-navy">
        {/* Top: Logo + Nav */}
        <div className="flex flex-col gap-8">
          {/* Logo Row */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 text-navy bg-teal rounded">
              <BookOpenIcon />
            </div>
            <span className="font-heading text-lg font-bold text-white">Timemaxx</span>
          </div>

          {/* Nav Menu */}
          <nav className="flex flex-col gap-1">
            <Link
              to="/dashboard"
              className="flex items-center h-11 w-full gap-2.5 px-3.5 text-sky-blue rounded-lg hover:bg-white/10"
            >
              <DashboardIcon />
              <span className="font-heading text-sm font-normal">Dashboard</span>
            </Link>
            <div className="flex items-center h-11 w-full gap-2.5 px-3.5 text-sky-blue rounded-lg">
              <TasksIcon />
              <span className="font-heading text-sm font-normal">Tasks</span>
            </div>
            <div className="flex items-center h-11 w-full gap-2.5 px-3.5 text-sky-blue rounded-lg">
              <ScheduleIcon />
              <span className="font-heading text-sm font-normal">Schedule</span>
            </div>
            <Link
              to="/profile"
              className="flex items-center h-11 w-full gap-2.5 px-3.5 text-navy bg-white rounded-lg"
            >
              <UserIcon />
              <span className="font-heading text-sm font-semibold">Profile</span>
            </Link>
          </nav>
        </div>

        {/* Footer: User Info */}
        <div className="flex items-center gap-2.5">
          <div className="flex flex-shrink-0 items-center justify-center h-9 w-9 bg-sky-blue rounded-full">
            <span className="font-heading text-sm font-bold text-navy">AJ</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-heading text-sm font-semibold text-white">Alex Johnson</span>
            <span className="font-body text-xs text-sky-blue">alex@jhu.edu</span>
          </div>
        </div>
      </aside>

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
            <div className="flex flex-shrink-0 items-center justify-center h-[72px] w-[72px] bg-sky-blue rounded-full">
              <span className="font-heading text-2xl font-bold text-navy">AJ</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-heading text-2xl font-bold text-navy">Alex Johnson</span>
              <span className="font-body text-sm text-slate-blue">alex@jhu.edu</span>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-border" />

          {/* Fields Row 1 */}
          <div className="flex w-full gap-8">
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="font-body text-xs font-semibold text-slate-blue">Full Name</span>
              <span className="font-heading text-base font-medium text-navy">Alex Johnson</span>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="font-body text-xs font-semibold text-slate-blue">Email</span>
              <span className="font-heading text-base font-medium text-navy">alex@jhu.edu</span>
            </div>
          </div>

          {/* Fields Row 2 */}
          <div className="flex w-full gap-8">
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="font-body text-xs font-semibold text-slate-blue">School</span>
              <span className="font-heading text-base font-medium text-navy">Johns Hopkins University</span>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="font-body text-xs font-semibold text-slate-blue">Year</span>
              <span className="font-heading text-base font-medium text-navy">Junior</span>
            </div>
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

function BookOpenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    </svg>
  );
}

function ScheduleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
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
