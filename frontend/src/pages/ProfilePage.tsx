import { useAuthActions } from "@convex-dev/auth/react";
import { LogoutIcon } from '../components/icons/icons';
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/sidebar";
import { useQuery } from "convex/react";
import { api } from "../../../backend/convex/_generated/api";

export default function ProfilePage() {
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const user = useQuery(api.queries.users.getCurrUser);

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

