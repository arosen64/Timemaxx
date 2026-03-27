import { KeyboardEvent, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { Id } from '../../../backend/convex/_generated/dataModel'
import { ProfileData, Course } from '../types'
import CourseSelector from './CourseSelector'
import { GRADES, STUDY_GOALS, YEARS } from '../constants'

interface TagInputProps {
  tags: string[]
  onChange?: (tags: string[]) => void
  placeholder: string
  readOnly?: boolean
}

function TagInput({ tags, onChange, placeholder, readOnly = false }: TagInputProps) {
  const [input, setInput] = useState('')

  const addTag = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onChange?.([...tags, trimmed])
    }
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange?.(tags.slice(0, -1))
    }
  }

  const removeTag = (index: number) => {
    onChange?.(tags.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-bg-gray p-2 focus-within:border-sky-blue focus-within:ring-2 focus-within:ring-sky-blue/20">
      {tags.length === 0 && readOnly ? (
        <span className="font-body text-sm italic text-light-blue">None</span>
      ) : (
        tags.map((tag, i) => (
          <span
            key={i}
            className="flex items-center gap-1 rounded-full bg-navy/10 px-3 py-1 font-body text-sm text-navy"
          >
            {tag}
            {!readOnly && (
              <button
                type="button"
                onClick={() => removeTag(i)}
                className="ml-1 text-navy/50 hover:text-navy"
              >
                ×
              </button>
            )}
          </span>
        ))
      )}
      {!readOnly && (
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(input)}
          placeholder={tags.length === 0 ? placeholder : 'Add more...'}
          className="min-w-[140px] flex-1 bg-transparent font-body text-sm text-navy outline-none placeholder:text-light-blue"
        />
      )}
    </div>
  )
}

interface ProfileFormProps {
  data: ProfileData
  onChange: (data: ProfileData) => void
  errors: { major?: string; year?: string }
  readOnly?: boolean
}

export default function ProfileForm({ data, onChange, errors, readOnly = false }: ProfileFormProps) {
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
          Major / Field of Study {!readOnly && <span className="text-urgent-red">*</span>}
        </label>
        <input
          type="text"
          value={data.major}
          readOnly={readOnly}
          onChange={readOnly ? undefined : (e) => update('major', e.target.value)}
          placeholder={readOnly ? undefined : 'e.g. Computer Science'}
          className={`rounded-lg border bg-bg-gray px-3 py-2 font-body text-sm text-navy outline-none ${
            readOnly
              ? 'cursor-default border-border'
              : `placeholder:text-light-blue focus:ring-2 focus:ring-sky-blue/20 ${
                  errors.major ? 'border-urgent-red' : 'border-border focus:border-sky-blue'
                }`
          }`}
        />
        {!readOnly && errors.major && <p className="font-body text-xs text-urgent-red">{errors.major}</p>}
      </div>

      {/* Year */}
      <div className="flex flex-col gap-1">
        <label className="font-heading text-sm font-semibold text-navy">
          Current Year {!readOnly && <span className="text-urgent-red">*</span>}
        </label>
        {readOnly && !data.year ? (
          <p className="font-body text-sm italic text-light-blue">Not set</p>
        ) : (
          <select
            id="year-select"
            value={data.year}
            disabled={readOnly}
            onChange={(e) => update('year', e.target.value)}
            className={`rounded-lg border bg-bg-gray px-3 py-2 font-body text-sm text-navy outline-none disabled:pointer-events-none ${
              readOnly
                ? 'cursor-default border-border'
                : `focus:ring-2 focus:ring-sky-blue/20 ${
                    errors.year ? 'border-urgent-red' : 'border-border focus:border-sky-blue'
                  }`
            }`}
          >
            <option value="">Select your year</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}
        {!readOnly && errors.year && <p className="font-body text-xs text-urgent-red">{errors.year}</p>}
      </div>

      {/* Difficult Subjects */}
      <div className="flex flex-col gap-1">
        <label className="font-heading text-sm font-semibold text-navy">Subjects You Find Difficult</label>
        {!readOnly && <p className="font-body text-xs text-light-blue">Press Enter or comma to add each subject</p>}
        <TagInput
          tags={data.difficultSubjects}
          onChange={(tags) => update('difficultSubjects', tags)}
          placeholder="e.g. Organic Chemistry"
          readOnly={readOnly}
        />
      </div>

      {/* Enjoyed Subjects */}
      <div className="flex flex-col gap-1">
        <label className="font-heading text-sm font-semibold text-navy">Subjects You Enjoy</label>
        {!readOnly && <p className="font-body text-xs text-light-blue">Press Enter or comma to add each subject</p>}
        <TagInput
          tags={data.enjoyedSubjects}
          onChange={(tags) => update('enjoyedSubjects', tags)}
          placeholder="e.g. Linear Algebra"
          readOnly={readOnly}
        />
      </div>

      {/* Courses — term + school + search */}
      <div className="flex flex-col gap-3">
        {!readOnly && <CourseSelector onAddCourse={handleAddCourse} />}

        {/* Added courses list */}
        {data.courses.map((course, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-bg-gray p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-body text-sm font-semibold text-navy">{course.title}</span>
                {course.term && (
                  <span className="inline-block w-fit rounded-full bg-navy/10 px-2 py-0.5 font-body text-xs font-medium text-navy">
                    {course.term}
                  </span>
                )}
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemoveCourse(i)}
                  className="text-light-blue transition-colors hover:text-urgent-red"
                >
                  ×
                </button>
              )}
            </div>
            {course.grade !== undefined ? (
              <div className="flex items-center gap-2">
                <span className="font-body text-xs text-slate-blue">Grade:</span>
                {readOnly && !course.grade ? (
                  <span className="font-body text-xs italic text-light-blue">Not set</span>
                ) : (
                  <select
                    value={course.grade}
                    disabled={readOnly}
                    onChange={(e) => {
                      const updated = data.courses.map((c, j) =>
                        j === i ? { ...c, grade: e.target.value } : c
                      )
                      update('courses', updated)
                    }}
                    className={`rounded-lg border border-border bg-white px-2 py-1 font-body text-xs text-navy outline-none disabled:pointer-events-none ${
                      readOnly
                        ? 'cursor-default'
                        : 'focus:border-sky-blue focus:ring-1 focus:ring-sky-blue/20'
                    }`}
                  >
                    <option value="">Select grade</option>
                    {GRADES.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                {STUDY_GOALS.map((goal) => (
                  <label
                    key={goal}
                    className={`flex flex-1 items-center justify-center rounded-lg border px-2 py-2 font-body text-xs font-medium ${
                      readOnly ? 'cursor-default' : 'cursor-pointer transition-colors'
                    } ${
                      course.studyGoal === goal
                        ? 'border-sky-blue bg-sky-blue/10 text-navy'
                        : readOnly
                          ? 'border-border text-slate-blue'
                          : 'border-border text-slate-blue hover:border-sky-blue/50 hover:bg-sky-blue/5'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`studyGoal-${i}`}
                      value={goal}
                      checked={course.studyGoal === goal}
                      disabled={readOnly}
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
