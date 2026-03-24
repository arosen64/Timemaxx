import { useState, KeyboardEvent } from 'react'
import { ProfileData, Course } from '../../types'

const YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate']
const STUDY_GOALS = ['Just pass', 'Do well', 'Ace it']

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder: string
}

function TagInput({ tags, onChange, placeholder }: TagInputProps) {
  const [input, setInput] = useState('')

  const addTag = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed])
    }
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-gray-300 p-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500">
      {tags.map((tag, i) => (
        <span
          key={i}
          className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(i)}
            className="ml-1 text-blue-500 hover:text-blue-800"
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(input)}
        placeholder={tags.length === 0 ? placeholder : 'Add more...'}
        className="min-w-[140px] flex-1 text-sm outline-none"
      />
    </div>
  )
}

interface ProfileFormProps {
  data: ProfileData
  onChange: (data: ProfileData) => void
  errors: { major?: string; year?: string }
}

export default function ProfileForm({ data, onChange, errors }: ProfileFormProps) {
  const update = <K extends keyof ProfileData>(field: K, value: ProfileData[K]) => {
    onChange({ ...data, [field]: value })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Tell us about yourself</h2>
        <p className="mt-1 text-sm text-gray-500">This helps us personalize your study plan.</p>
      </div>

      {/* Major */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Major / Field of Study <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.major}
          onChange={(e) => update('major', e.target.value)}
          placeholder="e.g. Computer Science"
          className={`rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.major ? 'border-red-400' : 'border-gray-300 focus:border-blue-500'
          }`}
        />
        {errors.major && <p className="text-xs text-red-500">{errors.major}</p>}
      </div>

      {/* Year */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Current Year <span className="text-red-500">*</span>
        </label>
        <select
          value={data.year}
          onChange={(e) => update('year', e.target.value)}
          className={`rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.year ? 'border-red-400' : 'border-gray-300 focus:border-blue-500'
          }`}
        >
          <option value="">Select your year</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        {errors.year && <p className="text-xs text-red-500">{errors.year}</p>}
      </div>

      {/* Difficult Subjects */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Subjects You Find Difficult</label>
        <p className="text-xs text-gray-400">Press Enter or comma to add each subject</p>
        <TagInput
          tags={data.difficultSubjects}
          onChange={(tags) => update('difficultSubjects', tags)}
          placeholder="e.g. Organic Chemistry"
        />
      </div>

      {/* Enjoyed Subjects */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Subjects You Enjoy</label>
        <p className="text-xs text-gray-400">Press Enter or comma to add each subject</p>
        <TagInput
          tags={data.enjoyedSubjects}
          onChange={(tags) => update('enjoyedSubjects', tags)}
          placeholder="e.g. Linear Algebra"
        />
      </div>

      {/* Courses */}
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700">Current Courses</label>
          <p className="mt-0.5 text-xs text-gray-400">Add each course and set your goal for it</p>
        </div>
        {data.courses.map((course, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={course.title}
                onChange={(e) => {
                  const updated = data.courses.map((c, j) =>
                    j === i ? { ...c, title: e.target.value } : c
                  )
                  update('courses', updated)
                }}
                placeholder="e.g. CS 101"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => update('courses', data.courses.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-500"
              >
                ×
              </button>
            </div>
            <div className="flex gap-2">
              {STUDY_GOALS.map((goal) => (
                <label
                  key={goal}
                  className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                    course.studyGoal === goal
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`studyGoal-${i}`}
                    value={goal}
                    checked={course.studyGoal === goal}
                    onChange={() => {
                      const updated = data.courses.map((c, j) =>
                        j === i ? { ...c, studyGoal: goal } : c
                      )
                      update('courses', updated)
                    }}
                    className="sr-only"
                  />
                  {goal}
                </label>
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => update('courses', [...data.courses, { title: '', studyGoal: '' }])}
          className="flex items-center gap-1 self-start rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600"
        >
          + Add course
        </button>
      </div>
    </div>
  )
}

// Exported for use in OnboardingPage default state
export const DEFAULT_COURSE: Course = { title: '', studyGoal: '' }
