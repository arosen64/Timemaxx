import { KeyboardEvent, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { Id } from '../../../backend/convex/_generated/dataModel'
import { ProfileData, Course } from '../types'
import CourseSelector from './CourseSelector'

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
    <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-bg-gray p-2 focus-within:border-sky-blue focus-within:ring-2 focus-within:ring-sky-blue/20">
      {tags.map((tag, i) => (
        <span
          key={i}
          className="flex items-center gap-1 rounded-full bg-navy/10 px-3 py-1 font-body text-sm text-navy"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(i)}
            className="ml-1 text-navy/50 hover:text-navy"
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
        className="min-w-[140px] flex-1 bg-transparent font-body text-sm text-navy outline-none placeholder:text-light-blue"
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
  const deleteUserCourse = useMutation(api.mutations.userCourses.deleteUserCourse)

  const update = <K extends keyof ProfileData>(field: K, value: ProfileData[K]) => {
    onChange({ ...data, [field]: value })
  }

  const handleAddCourse = (course: Course) => {
    if (data.courses.some((c) => c.title === course.title)) return
    onChange({ ...data, courses: [...data.courses, course] })
  }

  const handleRemoveCourse = async (index: number) => {
    const course = data.courses[index]
    if (course.userCourseId) {
      await deleteUserCourse({ userCourseId: course.userCourseId as Id<'userCourses'> })
    }
    update('courses', data.courses.filter((_, j) => j !== index))
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-2xl font-bold text-navy">Tell us about yourself</h2>
        <p className="mt-1 font-body text-sm text-slate-blue">This helps us personalize your study plan.</p>
      </div>

      {/* Major */}
      <div className="flex flex-col gap-1">
        <label className="font-heading text-sm font-semibold text-navy">
          Major / Field of Study <span className="text-urgent-red">*</span>
        </label>
        <input
          type="text"
          value={data.major}
          onChange={(e) => update('major', e.target.value)}
          placeholder="e.g. Computer Science"
          className={`rounded-lg border bg-bg-gray px-3 py-2 font-body text-sm text-navy outline-none placeholder:text-light-blue focus:ring-2 focus:ring-sky-blue/20 ${
            errors.major ? 'border-urgent-red' : 'border-border focus:border-sky-blue'
          }`}
        />
        {errors.major && <p className="font-body text-xs text-urgent-red">{errors.major}</p>}
      </div>

      {/* Year */}
      <div className="flex flex-col gap-1">
        <label className="font-heading text-sm font-semibold text-navy">
          Current Year <span className="text-urgent-red">*</span>
        </label>
        <select
          id="year-select"
          value={data.year}
          onChange={(e) => update('year', e.target.value)}
          className={`rounded-lg border bg-bg-gray px-3 py-2 font-body text-sm text-navy outline-none focus:ring-2 focus:ring-sky-blue/20 ${
            errors.year ? 'border-urgent-red' : 'border-border focus:border-sky-blue'
          }`}
        >
          <option value="">Select your year</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {errors.year && <p className="font-body text-xs text-urgent-red">{errors.year}</p>}
      </div>

      {/* Difficult Subjects */}
      <div className="flex flex-col gap-1">
        <label className="font-heading text-sm font-semibold text-navy">Subjects You Find Difficult</label>
        <p className="font-body text-xs text-light-blue">Press Enter or comma to add each subject</p>
        <TagInput
          tags={data.difficultSubjects}
          onChange={(tags) => update('difficultSubjects', tags)}
          placeholder="e.g. Organic Chemistry"
        />
      </div>

      {/* Enjoyed Subjects */}
      <div className="flex flex-col gap-1">
        <label className="font-heading text-sm font-semibold text-navy">Subjects You Enjoy</label>
        <p className="font-body text-xs text-light-blue">Press Enter or comma to add each subject</p>
        <TagInput
          tags={data.enjoyedSubjects}
          onChange={(tags) => update('enjoyedSubjects', tags)}
          placeholder="e.g. Linear Algebra"
        />
      </div>

      {/* Courses — term + school + search */}
      <div className="flex flex-col gap-3">
        <CourseSelector onAddCourse={handleAddCourse} />

        {/* Added courses list */}
        {data.courses.map((course, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-gray-800">{course.title}</span>
                {course.term && <span className="text-xs text-gray-400">{course.term}</span>}
              </div>
              <button
                type="button"
                onClick={() => handleRemoveCourse(i)}
                className="text-gray-400 hover:text-red-500"
              >
                ×
              </button>
            </div>
            {course.grade !== undefined ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Grade:</span>
                <select
                  value={course.grade}
                  onChange={(e) => {
                    const updated = data.courses.map((c, j) =>
                      j === i ? { ...c, grade: e.target.value } : c
                    )
                    update('courses', updated)
                  }}
                  className="rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select grade</option>
                  {['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'IP'].map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            ) : (
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
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Exported for use in OnboardingPage default state
export const DEFAULT_COURSE: Course = { title: '', studyGoal: '' }
