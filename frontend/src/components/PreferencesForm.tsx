import { useState, KeyboardEvent } from 'react'
import { PreferencesData } from '../types'

const CATEGORIES = [
  {
    key: 'timeOfDay',
    label: '🕐 Time of Day',
    description: 'When you feel most productive',
    options: [
      'Early Morning (5–8am)',
      'Morning (8–11am)',
      'Midday (11am–2pm)',
      'Afternoon (2–5pm)',
      'Evening (5–8pm)',
      'Night (8–11pm)',
      'Late Night (11pm+)',
    ],
  },
  {
    key: 'dayOfWeek',
    label: '📅 Day of Week',
    description: 'Your most productive days',
    options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  },
  {
    key: 'workSessionStyle',
    label: '⚡ Work Session Style',
    description: 'How you prefer to structure study sessions',
    options: [
      'Short bursts (25–30 min)',
      'Medium sessions (45–60 min)',
      'Long deep work (2+ hours)',
      'Varies by task',
    ],
  },
  {
    key: 'deadlineBehavior',
    label: '⏰ Deadline Behavior',
    description: 'How deadlines affect your work',
    options: [
      'I work best well in advance',
      'I need the pressure of a deadline',
      'Somewhere in between',
    ],
  },
  {
    key: 'breakPreferences',
    label: '🔄 Break Preferences',
    description: 'How you like to take breaks',
    options: [
      'Frequent short breaks (every 25–30 min)',
      'Occasional medium breaks (every hour)',
      'Few long breaks (every 2+ hours)',
      "I don't take planned breaks",
    ],
  },
  {
    key: 'subjectSwitching',
    label: '📚 Subject/Task Switching',
    description: 'How you prefer to switch between topics',
    options: [
      'I prefer focusing on one subject per session',
      'I like switching between subjects',
      'Depends on the day',
    ],
  },
]

interface CategorySectionProps {
  label: string
  description: string
  options: string[]
  selected: string[]
  onToggle: (option: string) => void
  onAddCustom: (value: string) => void
}

function CategorySection({
  label,
  description,
  options,
  selected,
  onToggle,
  onAddCustom,
}: CategorySectionProps) {
  const [customInput, setCustomInput] = useState('')

  const handleAddCustom = () => {
    const trimmed = customInput.trim()
    if (trimmed && !selected.includes(trimmed)) {
      onAddCustom(trimmed)
    }
    setCustomInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddCustom()
    }
  }

  // Custom traits = selected items not in the predefined options list
  const customTraits = selected.filter((s) => !options.includes(s))

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              selected.includes(option)
                ? 'border-blue-500 bg-blue-600 text-white'
                : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:bg-blue-50'
            }`}
          >
            {option}
          </button>
        ))}
        {/* Custom trait chips */}
        {customTraits.map((trait) => (
          <span
            key={trait}
            className="flex items-center gap-1 rounded-full border border-blue-500 bg-blue-600 px-3 py-1 text-sm text-white"
          >
            {trait}
            <button
              type="button"
              onClick={() => onToggle(trait)}
              className="ml-0.5 opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {/* Custom trait input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add custom..."
          className="rounded-lg border border-dashed border-gray-300 px-3 py-1 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        />
        {customInput.trim() && (
          <button
            type="button"
            onClick={handleAddCustom}
            className="rounded-lg bg-blue-50 px-3 py-1 text-sm text-blue-600 hover:bg-blue-100"
          >
            Add
          </button>
        )}
      </div>
    </div>
  )
}

export const DEFAULT_PREFERENCES: PreferencesData = {
  traits: {},
  focusBlockLength: '',
}

interface PreferencesFormProps {
  data: PreferencesData
  onChange: (data: PreferencesData) => void
  focusBlockError?: string
}

export default function PreferencesForm({ data, onChange, focusBlockError }: PreferencesFormProps) {
  const getSelected = (key: string): string[] => data.traits[key] ?? []

  const handleToggle = (key: string, option: string) => {
    const current = getSelected(key)
    const updated = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option]
    onChange({ ...data, traits: { ...data.traits, [key]: updated } })
  }

  const handleAddCustom = (key: string, value: string) => {
    const current = getSelected(key)
    onChange({ ...data, traits: { ...data.traits, [key]: [...current, value] } })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Productivity Preferences</h2>
        <p className="mt-1 text-sm text-gray-500">
          Select everything that applies — this helps us schedule smarter.
        </p>
      </div>

      {CATEGORIES.map((cat) => (
        <CategorySection
          key={cat.key}
          label={cat.label}
          description={cat.description}
          options={cat.options}
          selected={getSelected(cat.key)}
          onToggle={(option) => handleToggle(cat.key, option)}
          onAddCustom={(value) => handleAddCustom(cat.key, value)}
        />
      ))}

      {/* Focus block length */}
      <div className="flex flex-col gap-1 border-t border-gray-100 pt-4">
        <label className="text-sm font-semibold text-gray-800">
          Focus Block Length (minutes) <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-400">How long is your ideal uninterrupted study session?</p>
        <input
          type="number"
          min={5}
          max={480}
          value={data.focusBlockLength}
          onChange={(e) =>
            onChange({
              ...data,
              focusBlockLength: e.target.value === '' ? '' : Number(e.target.value),
            })
          }
          placeholder="e.g. 45"
          className={`w-32 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
            focusBlockError ? 'border-red-400' : 'border-gray-300 focus:border-blue-500'
          }`}
        />
        {focusBlockError && <p className="text-xs text-red-500">{focusBlockError}</p>}
      </div>
    </div>
  )
}
