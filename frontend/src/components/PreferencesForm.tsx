import { useState, KeyboardEvent } from "react";
import { PreferencesData } from "../types";

export const MIN_FOCUS_BLOCK_MINUTES = 15;

const CATEGORIES = [
  {
    key: "timeOfDay",
    label: "🕐 Time of Day",
    description: "When you feel most productive",
    options: [
      "Early Morning (5–8am)",
      "Morning (8–11am)",
      "Midday (11am–2pm)",
      "Afternoon (2–5pm)",
      "Evening (5–8pm)",
      "Night (8–11pm)",
      "Late Night (11pm+)",
    ],
  },
  {
    key: "dayOfWeek",
    label: "📅 Day of Week",
    description: "Your most productive days",
    options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  },
  {
    key: "workSessionStyle",
    label: "⚡ Work Session Style",
    description: "How you prefer to structure study sessions",
    options: [
      "Short bursts (25–30 min)",
      "Medium sessions (45–60 min)",
      "Long deep work (2+ hours)",
      "Varies by task",
    ],
  },
  {
    key: "deadlineBehavior",
    label: "⏰ Deadline Behavior",
    description: "How deadlines affect your work",
    singleSelect: true,
    options: [
      "I work best well in advance",
      "I need the pressure of a deadline",
      "Somewhere in between",
    ],
  },
];

interface CategorySectionProps {
  label: string;
  description: string;
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  onAddCustom: (value: string) => void;
  singleSelect?: boolean;
  readOnly?: boolean;
}

function CategorySection({
  label,
  description,
  options,
  selected,
  onToggle,
  onAddCustom,
  singleSelect = false,
  readOnly = false,
}: CategorySectionProps) {
  const [customInput, setCustomInput] = useState("");

  const handleAddCustom = () => {
    const trimmed = customInput.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onAddCustom(trimmed);
    }
    setCustomInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustom();
    }
  };

  // Custom traits = selected items not in the predefined options list
  const customTraits = selected.filter((s) => !options.includes(s));

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="font-heading text-sm font-semibold text-navy">{label}</p>
        <p className="font-body text-xs text-light-blue">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={readOnly}
            onClick={() => onToggle(option)}
            className={`rounded-full border px-3 py-1 font-body text-sm transition-colors disabled:pointer-events-none ${
              selected.includes(option)
                ? "border-navy bg-navy text-white"
                : "border-border text-slate-blue hover:border-sky-blue hover:bg-bg-gray"
            }`}
          >
            {option}
          </button>
        ))}
        {/* Custom trait chips */}
        {!singleSelect &&
          customTraits.map((trait) => (
            <span
              key={trait}
              className="flex items-center gap-1 rounded-full border border-navy bg-navy px-3 py-1 font-body text-sm text-white"
            >
              {trait}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onToggle(trait)}
                  className="ml-0.5 opacity-70 hover:opacity-100"
                >
                  ×
                </button>
              )}
            </span>
          ))}
      </div>
      {/* Custom trait input */}
      {!singleSelect && !readOnly && (
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add notes..."
            className="rounded-lg border border-dashed border-border bg-bg-gray px-3 py-1 font-body text-sm text-navy outline-none placeholder:text-light-blue focus:border-sky-blue focus:ring-1 focus:ring-sky-blue/20"
          />
          {customInput.trim() && (
            <button
              type="button"
              onClick={handleAddCustom}
              className="rounded-lg bg-navy/10 px-3 py-1 font-body text-sm text-navy hover:bg-navy/20"
            >
              Add
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const DEFAULT_PREFERENCES: PreferencesData = {
  traits: {},
  focusBlockLength: "",
};

interface PreferencesFormProps {
  data: PreferencesData;
  onChange: (data: PreferencesData) => void;
  readOnly?: boolean;
}

export default function PreferencesForm({
  data,
  onChange,
  readOnly = false,
}: PreferencesFormProps) {
  const getSelected = (key: string): string[] => data.traits[key] ?? [];

  const handleToggle = (key: string, option: string, singleSelect: boolean) => {
    const current = getSelected(key);
    const updated = singleSelect
      ? current.includes(option)
        ? []
        : [option]
      : current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
    onChange({ ...data, traits: { ...data.traits, [key]: updated } });
  };

  const handleAddCustom = (key: string, value: string) => {
    const current = getSelected(key);
    onChange({ ...data, traits: { ...data.traits, [key]: [...current, value] } });
  };

  return (
    <div className="flex flex-col gap-6">
      {CATEGORIES.map((cat) => (
        <CategorySection
          key={cat.key}
          label={cat.label}
          description={cat.description}
          options={cat.options}
          selected={getSelected(cat.key)}
          onToggle={(option) => handleToggle(cat.key, option, cat.singleSelect ?? false)}
          onAddCustom={(value) => handleAddCustom(cat.key, value)}
          singleSelect={cat.singleSelect}
          readOnly={readOnly}
        />
      ))}

      {/* Focus block length */}
      <div className="flex flex-col gap-1 border-t border-border pt-4">
        <label className="font-heading text-sm font-semibold text-navy">
          Focus Block Length (minutes)
        </label>
        <p className="font-body text-xs text-light-blue">
          How long is your ideal uninterrupted study session?
        </p>
        <input
          type="number"
          min={MIN_FOCUS_BLOCK_MINUTES}
          max={480}
          value={data.focusBlockLength}
          readOnly={readOnly}
          onChange={
            readOnly
              ? undefined
              : (e) =>
                  onChange({
                    ...data,
                    focusBlockLength: e.target.value === "" ? "" : Number(e.target.value),
                  })
          }
          placeholder={readOnly ? undefined : "e.g. 45"}
          className={`w-32 rounded-lg border border-border bg-bg-gray px-3 py-2 font-body text-sm text-navy outline-none ${
            readOnly
              ? "cursor-default"
              : "placeholder:text-light-blue focus:border-sky-blue focus:ring-2 focus:ring-sky-blue/20"
          }`}
        />
        {!readOnly &&
          typeof data.focusBlockLength === "number" &&
          data.focusBlockLength < MIN_FOCUS_BLOCK_MINUTES && (
            <p className="font-body text-xs text-burnt-orange">
              Study block length must be at least {MIN_FOCUS_BLOCK_MINUTES} minutes.
            </p>
          )}
      </div>
    </div>
  );
}
