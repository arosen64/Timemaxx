import { useState } from "react";
import Sidebar from "../components/Sidebar";
import { ChevronDownIcon } from "../components/icons";
import ProfileForm from "../components/ProfileForm";
import WorkHoursSelector from "../components/WorkHoursSelector";
import PreferencesForm from "../components/PreferencesForm";
import { ProfileData, WorkHoursData, PreferencesData } from "../types";

const DAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const emptyProfile: ProfileData = {
  major: "",
  year: "",
  difficultSubjects: [],
  enjoyedSubjects: [],
  courses: [],
};

const emptyWorkHours: WorkHoursData = Object.fromEntries(
  DAYS_FULL.map((day) => [day, { available: [], blocked: [] }])
);

const emptyPreferences: PreferencesData = {
  traits: {},
  focusBlockLength: "",
};

export default function PreferencesPage() {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggle = (id: string) =>
    setOpenSection((prev) => (prev === id ? null : id));

  return (
    <div className="flex h-screen font-body bg-bg-gray">
      <Sidebar />

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-y-auto gap-8 p-10">
        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-bold text-navy">Preferences</h1>
          <p className="font-body text-sm text-slate-blue">
            Manage your study preferences and availability
          </p>
        </div>

        {/* Sections */}
        <div className="flex flex-col gap-4">
          {/* About You */}
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggle("about")}
              className="flex items-center justify-between w-full px-6 py-5 text-left hover:bg-bg-gray transition-colors"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-heading text-lg font-bold text-navy">About You</span>
                <span className="font-body text-sm text-slate-blue">Your academic background and courses</span>
              </div>
              <span className={`flex-shrink-0 text-navy transition-transform duration-200 ${openSection === "about" ? "rotate-180" : ""}`}>
                <ChevronDownIcon size={20} />
              </span>
            </button>
            {openSection === "about" && (
              <>
                <div className="h-px w-full bg-border" />
                <div className="px-6 py-5">
                  <ProfileForm
                    data={emptyProfile}
                    onChange={() => {}}
                    errors={{}}
                    readOnly
                  />
                </div>
              </>
            )}
          </div>

          {/* Work Hours */}
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggle("workhours")}
              className="flex items-center justify-between w-full px-6 py-5 text-left hover:bg-bg-gray transition-colors"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-heading text-lg font-bold text-navy">Work Hours</span>
                <span className="font-body text-sm text-slate-blue">When you're available to study each week</span>
              </div>
              <span className={`flex-shrink-0 text-navy transition-transform duration-200 ${openSection === "workhours" ? "rotate-180" : ""}`}>
                <ChevronDownIcon size={20} />
              </span>
            </button>
            {openSection === "workhours" && (
              <>
                <div className="h-px w-full bg-border" />
                <div className="px-6 py-5">
                  <WorkHoursSelector
                    data={emptyWorkHours}
                    onChange={() => {}}
                    readOnly
                  />
                </div>
              </>
            )}
          </div>

          {/* Productivity Preferences */}
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggle("productivity")}
              className="flex items-center justify-between w-full px-6 py-5 text-left hover:bg-bg-gray transition-colors"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-heading text-lg font-bold text-navy">Productivity Preferences</span>
                <span className="font-body text-sm text-slate-blue">How you like to structure your study sessions</span>
              </div>
              <span className={`flex-shrink-0 text-navy transition-transform duration-200 ${openSection === "productivity" ? "rotate-180" : ""}`}>
                <ChevronDownIcon size={20} />
              </span>
            </button>
            {openSection === "productivity" && (
              <>
                <div className="h-px w-full bg-border" />
                <div className="px-6 py-5">
                  <PreferencesForm
                    data={emptyPreferences}
                    onChange={() => {}}
                    readOnly
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
