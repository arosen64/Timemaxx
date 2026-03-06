import { useAuthActions } from "@convex-dev/auth/react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/sidebar";

export default function ProfilePage() {
  const { signOut } = useAuthActions();
  const navigate = useNavigate();

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

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
