import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../backend/convex/_generated/api";
import type { WorkHoursData } from "../types";
import { CalendarIcon, ChevronDownIcon } from "../components/icons";
import ProfileForm from "../components/ProfileForm";
import WorkHoursSelector, { DEFAULT_WORK_HOURS } from "../components/WorkHoursSelector";
import PreferencesForm from "../components/PreferencesForm";
import AcademicProfileSummary from "../components/AcademicProfileSummary";
import { ProfileData, PreferencesData } from "../types";

function dbToWorkHours(grid: { day: string; blocked: number[] }[] | undefined): WorkHoursData {
  if (!grid) return DEFAULT_WORK_HOURS;
  return Object.fromEntries(grid.map(({ day, blocked }) => [day, { blocked }]));
}

export default function PreferencesPage() {
  const user = useQuery(api.queries.users.getCurrUser);
  const userCourses = useQuery(api.queries.userCourses.getUserCourses);
  const calendarStatus = useQuery(api.queries.calendar.getCalendarConnectionStatus);
  const updateSettings = useMutation(api.mutations.users.updateUserSettings);
  const runDetectConflicts = useMutation(api.mutations.studyBlocks.runDetectConflicts);

  const [openSection, setOpenSection] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingGcalColor, setIsTogglingGcalColor] = useState(false);

  // Per-section draft state (only set while editing)
  const [profileDraft, setProfileDraft] = useState<ProfileData | null>(null);
  const [workHoursDraft, setWorkHoursDraft] = useState<WorkHoursData | null>(null);
  const [preferencesDraft, setPreferencesDraft] = useState<PreferencesData | null>(null);

  const toggle = (id: string) => {
    setOpenSection((prev) => (prev === id ? null : id));
    if (editingSection === id) cancelEdit();
  };

  const startEdit = (section: string) => {
    if (!user) return;
    if (section === "about") {
      setProfileDraft({
        major: user.major ?? "",
        year: user.year ?? "",
        courses: (userCourses ?? []).map((c) => ({ title: c.title, studyGoal: c.studyGoal })),
      });
    } else if (section === "workhours") {
      setWorkHoursDraft(
        dbToWorkHours(user.workHoursGrid as { day: string; blocked: number[] }[] | undefined)
      );
    } else if (section === "productivity") {
      setPreferencesDraft({
        traits: (user.productivityTraits as PreferencesData["traits"]) ?? {},
        focusBlockLength: user.focusBlockLength ?? "",
      });
    }
    setEditingSection(section);
  };

  const cancelEdit = () => {
    setEditingSection(null);
    setProfileDraft(null);
    setWorkHoursDraft(null);
    setPreferencesDraft(null);
  };

  const save = async () => {
    setIsSaving(true);
    try {
      if (editingSection === "about" && profileDraft) {
        await updateSettings({
          major: profileDraft.major,
          year: profileDraft.year,
        });
      } else if (editingSection === "workhours" && workHoursDraft) {
        const newGrid = Object.entries(workHoursDraft).map(([day, slots]) => ({
          day: day as
            | "Monday"
            | "Tuesday"
            | "Wednesday"
            | "Thursday"
            | "Friday"
            | "Saturday"
            | "Sunday",
          blocked: slots.blocked,
        }));
        await updateSettings({ workHoursGrid: newGrid });
        // 3.3: Trigger conflict detection after work hours change
        await runDetectConflicts({
          timedEvents: [],
          workHoursGrid: newGrid,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }).catch(() => {});
      } else if (editingSection === "productivity" && preferencesDraft) {
        await updateSettings({
          productivityTraits: preferencesDraft.traits,
          focusBlockLength: preferencesDraft.focusBlockLength
            ? Number(preferencesDraft.focusBlockLength)
            : undefined,
        });
      }
      cancelEdit();
    } finally {
      setIsSaving(false);
    }
  };

  // Derived read-only data from DB
  const profileData: ProfileData = {
    major: user?.major ?? "",
    year: user?.year ?? "",
    courses: (userCourses ?? []).map((c) => ({ title: c.title, studyGoal: c.studyGoal })),
  };
  const workHoursData = dbToWorkHours(user?.workHoursGrid);
  const preferencesData: PreferencesData = {
    traits: (user?.productivityTraits as PreferencesData["traits"]) ?? {},
    focusBlockLength: user?.focusBlockLength ?? "",
  };

  const isEditing = (id: string) => editingSection === id;

  const gcalColorMappingEnabled = user?.gcalColorMappingEnabled ?? false;

  const handleGcalColorToggle = async () => {
    if (!user) return;
    setIsTogglingGcalColor(true);
    try {
      await updateSettings({ gcalColorMappingEnabled: !gcalColorMappingEnabled });
    } finally {
      setIsTogglingGcalColor(false);
    }
  };

  const SectionActions = ({ id }: { id: string }) => (
    <div className="flex gap-2">
      {isEditing(id) ? (
        <>
          <button
            onClick={cancelEdit}
            disabled={isSaving}
            className="px-4 py-1.5 font-heading text-sm font-semibold text-navy border border-border rounded-lg hover:bg-bg-gray transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={isSaving}
            className="px-4 py-1.5 font-heading text-sm font-semibold text-white bg-navy rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </>
      ) : (
        <button
          onClick={() => startEdit(id)}
          className="px-4 py-1.5 font-heading text-sm font-semibold text-navy border border-border rounded-lg hover:bg-bg-gray transition-colors"
        >
          Edit
        </button>
      )}
    </div>
  );

  return (
    <main className="flex flex-1 min-w-0 flex-col overflow-y-auto overflow-x-hidden gap-8 p-4 sm:p-6 lg:p-10 font-body bg-bg-gray">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-bold text-navy">Preferences</h1>
        <p className="font-body text-sm text-slate-blue">
          Manage your study preferences and availability
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Academic Profile Summary */}
        <div className="bg-white border border-border rounded-xl px-6 py-5">
          <AcademicProfileSummary profile={profileData} onChange={() => {}} />
        </div>

        {/* About You */}
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div
            onClick={() => toggle("about")}
            className="flex items-center justify-between w-full px-6 py-5 cursor-pointer hover:bg-bg-gray transition-colors"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-heading text-lg font-bold text-navy">About You</span>
              <span className="font-body text-sm text-slate-blue">
                Your academic background and courses
              </span>
            </div>
            <div className="flex items-center gap-3">
              {openSection === "about" && (
                <div onClick={(e) => e.stopPropagation()}>
                  <SectionActions id="about" />
                </div>
              )}
              <span
                className={`flex-shrink-0 text-navy transition-transform duration-200 ${openSection === "about" ? "rotate-180" : ""}`}
              >
                <ChevronDownIcon size={20} />
              </span>
            </div>
          </div>
          {openSection === "about" && (
            <>
              <div className="h-px w-full bg-border" />
              <div className="px-6 py-5">
                <ProfileForm
                  data={isEditing("about") ? profileDraft! : profileData}
                  onChange={setProfileDraft}
                  errors={{}}
                  readOnly={!isEditing("about")}
                />
              </div>
            </>
          )}
        </div>

        {/* Work Hours */}
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div
            onClick={() => toggle("workhours")}
            className="flex items-center justify-between w-full px-6 py-5 cursor-pointer hover:bg-bg-gray transition-colors"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-heading text-lg font-bold text-navy">Work Hours</span>
              <span className="font-body text-sm text-slate-blue">Select times to block off</span>
            </div>
            <div className="flex items-center gap-3">
              {openSection === "workhours" && (
                <div onClick={(e) => e.stopPropagation()}>
                  <SectionActions id="workhours" />
                </div>
              )}
              <span
                className={`flex-shrink-0 text-navy transition-transform duration-200 ${openSection === "workhours" ? "rotate-180" : ""}`}
              >
                <ChevronDownIcon size={20} />
              </span>
            </div>
          </div>
          {openSection === "workhours" && (
            <>
              <div className="h-px w-full bg-border" />
              <div className="px-6 py-5">
                <WorkHoursSelector
                  data={isEditing("workhours") ? workHoursDraft! : workHoursData}
                  onChange={setWorkHoursDraft}
                  readOnly={!isEditing("workhours")}
                />
              </div>
            </>
          )}
        </div>

        {/* Productivity Preferences */}
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div
            onClick={() => toggle("productivity")}
            className="flex items-center justify-between w-full px-6 py-5 cursor-pointer hover:bg-bg-gray transition-colors"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-heading text-lg font-bold text-navy">
                Productivity Preferences
              </span>
              <span className="font-body text-sm text-slate-blue">
                How you like to structure your study sessions
              </span>
            </div>
            <div className="flex items-center gap-3">
              {openSection === "productivity" && (
                <div onClick={(e) => e.stopPropagation()}>
                  <SectionActions id="productivity" />
                </div>
              )}
              <span
                className={`flex-shrink-0 text-navy transition-transform duration-200 ${openSection === "productivity" ? "rotate-180" : ""}`}
              >
                <ChevronDownIcon size={20} />
              </span>
            </div>
          </div>
          {openSection === "productivity" && (
            <>
              <div className="h-px w-full bg-border" />
              <div className="px-6 py-5">
                <PreferencesForm
                  data={isEditing("productivity") ? preferencesDraft! : preferencesData}
                  onChange={setPreferencesDraft}
                  readOnly={!isEditing("productivity")}
                />
              </div>
            </>
          )}
        </div>

        {/* Google Calendar Color Mapping — only shown when calendar is connected */}
        {calendarStatus?.connected && (
          <div className="flex items-center justify-between bg-white border border-border rounded-xl p-6 gap-4">
            <div className="flex items-center gap-3 flex-1">
              <CalendarIcon size={24} color="#002D72" />
              <div className="flex flex-col gap-1">
                <span className="font-heading text-sm font-semibold text-navy">
                  Map Timemaxx course color to exported Google Calendar blocks
                </span>
                <span className="font-body text-xs text-slate-blue">
                  When enabled, study blocks exported to Google Calendar will use your course
                  colors.
                </span>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={gcalColorMappingEnabled}
              onClick={handleGcalColorToggle}
              disabled={isTogglingGcalColor}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full p-0.5 transition-colors disabled:opacity-50 ${
                gcalColorMappingEnabled ? "bg-teal" : "bg-light-blue"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  gcalColorMappingEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
