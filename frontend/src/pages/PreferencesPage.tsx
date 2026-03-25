import { useState } from "react";
import Sidebar from "../components/Sidebar";
import { ChevronDownIcon } from "../components/icons";

const sections = [
  {
    id: "about",
    title: "About You",
    description: "Your academic background and courses",
  },
  {
    id: "workhours",
    title: "Work Hours",
    description: "When you're available to study each week",
  },
  {
    id: "productivity",
    title: "Productivity Preferences",
    description: "How you like to structure your study sessions",
  },
];

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
          {sections.map(({ id, title, description }) => {
            const isOpen = openSection === id;
            return (
              <div
                key={id}
                className="bg-white border border-border rounded-xl overflow-hidden"
              >
                {/* Header */}
                <button
                  onClick={() => toggle(id)}
                  className="flex items-center justify-between w-full px-6 py-5 text-left hover:bg-bg-gray transition-colors"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-heading text-lg font-bold text-navy">{title}</span>
                    <span className="font-body text-sm text-slate-blue">{description}</span>
                  </div>
                  <span
                    className={`flex-shrink-0 text-navy transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  >
                    <ChevronDownIcon size={20} />
                  </span>
                </button>

                {/* Body */}
                {isOpen && (
                  <>
                    <div className="h-px w-full bg-border" />
                    <div className="px-6 py-5">
                      <p className="font-body text-sm text-slate-blue italic">
                        To be implemented.
                      </p>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
