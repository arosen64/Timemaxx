import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useQuery } from "convex/react";
import { api } from "../../../backend/convex/_generated/api";
import ProfileActions from '../components/profile/ProfileActions'
import ProfileAvatar from '../components/profile/ProfileAvatar'
import ProfileField from '../components/profile/ProfileField'
import Button from '../components/ui/Button'

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = useQuery(api.queries.users.getCurrUser);

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

          {/* Account Actions */}
          <ProfileActions />
        </div>
      </main>
    </div>
  );
}
