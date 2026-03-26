import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../backend/convex/_generated/api";
import ProfileActions from "../components/profile/ProfileActions";
import ProfileAvatar from "../components/profile/ProfileAvatar";
import ProfileField from "../components/profile/ProfileField";
import Button from "../components/ui/Button";

export default function ProfilePage() {
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
          <ProfileAvatar
            name={user?.name}
            email={user?.email}
            image={user?.image}
            loading={user === undefined}
          />

          {/* Divider */}
          <div className="h-px w-full bg-border" />

          {/* Fields Row 1 */}
          <div className="flex w-full gap-8">
            <ProfileField label="Full Name" value={user?.name} loading={user === undefined} />
            <ProfileField label="Email" value={user?.email} loading={user === undefined} />
          </div>

          {/* Fields Row 2 */}
          {user === undefined ? (
            <div className="flex w-full gap-8">
              <ProfileField label="Major" loading />
              <ProfileField label="Year" loading />
            </div>
          ) : user?.onboardingComplete ? (
            <div className="flex w-full gap-8">
              <ProfileField label="Major" value={user.major} />
              <ProfileField label="Year" value={user.year} />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="font-body text-sm text-slate-blue">Complete your onboarding survey to fill in your academic details.</p>
              <Button variant="primary" onClick={() => navigate("/onboarding")} className="w-56">
                Complete Onboarding Survey
              </Button>
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
              <Button variant="destructive" onClick={handleRevokeCalendar} className="px-5">
                Revoke Access
              </Button>
            ) : (
              <Button variant="primary" icon={<CalendarIcon />} onClick={handleConnectCalendar} className="px-5">
                Connect Calendar
              </Button>
            )}
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-border" />

          {/* Account Actions */}
          <ProfileActions />
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
