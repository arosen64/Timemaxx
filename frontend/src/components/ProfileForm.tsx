import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { useAction } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { ProfileData, Course } from '../types'

const YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate']
const STUDY_GOALS = ['Just pass', 'Do well', 'Ace it']

interface JhuTerm {
  Name: string
  [key: string]: unknown
}

interface JhuSchool {
  Name: string
  [key: string]: unknown
}

interface JhuCourse {
  OfferingName: string
  Title: string
  [key: string]: unknown
}

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
  const getAvailableTerms = useAction(api.actions.jhsCourses.getAvailableTerms)
  const getAvailableSchools = useAction(api.actions.jhsCourses.getAvailableSchools)
  const getCoursesByTerm = useAction(api.actions.jhsCourses.getCoursesByTerm)

  const [terms, setTerms] = useState<JhuTerm[]>([])
  const [termsLoading, setTermsLoading] = useState(false)
  const [selectedTerm, setSelectedTerm] = useState('')

  const [schools, setSchools] = useState<JhuSchool[]>([])
  const [schoolsLoading, setSchoolsLoading] = useState(false)
  const [selectedSchool, setSelectedSchool] = useState('')

  const [termCourses, setTermCourses] = useState<JhuCourse[]>([])
  const [coursesLoading, setCoursesLoading] = useState(false)
  const [courseSearch, setCourseSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<JhuCourse | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTermsLoading(true)
    getAvailableTerms({})
      .then((res) => setTerms(res as JhuTerm[]))
      .catch(() => setTerms([]))
      .finally(() => setTermsLoading(false))
  }, [getAvailableTerms])

  useEffect(() => {
    setSchoolsLoading(true)
    getAvailableSchools({})
      .then((res) => setSchools(res as JhuSchool[]))
      .catch(() => setSchools([]))
      .finally(() => setSchoolsLoading(false))
  }, [getAvailableSchools])

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleTermChange = (term: string) => {
    setSelectedTerm(term)
    setSelectedSchool('')
    setTermCourses([])
    setCourseSearch('')
    setSelectedCourse(null)
  }

  const handleSchoolChange = (school: string) => {
    setSelectedSchool(school)
    setTermCourses([])
    setCourseSearch('')
    setSelectedCourse(null)
    if (!school || !selectedTerm) return
    setCoursesLoading(true)
    getCoursesByTerm({ term: selectedTerm, school })
      .then((res) => setTermCourses(res as JhuCourse[]))
      .catch(() => setTermCourses([]))
      .finally(() => setCoursesLoading(false))
  }

  const filteredCourses = courseSearch.trim().length >= 2
    ? termCourses.filter((c) =>
        `${c.OfferingName} ${c.Title}`.toLowerCase().includes(courseSearch.toLowerCase())
      ).slice(0, 50)
    : []

  const handleAddCourse = () => {
    if (!selectedCourse) return
    const title = `${selectedCourse.OfferingName}: ${selectedCourse.Title}`
    if (data.courses.some((c) => c.title === title)) return
    onChange({ ...data, courses: [...data.courses, { title, studyGoal: '' }] })
    setCourseSearch('')
    setSelectedCourse(null)
    setShowSuggestions(false)
  }

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
            <option key={y} value={y}>{y}</option>
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

      {/* Courses — term + school + search */}
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700">Current Courses</label>
          <p className="mt-0.5 text-xs text-gray-400">Select a term and school, then search for courses</p>
        </div>

        {/* Term selector */}
        <select
          value={selectedTerm}
          onChange={(e) => handleTermChange(e.target.value)}
          disabled={termsLoading}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="">{termsLoading ? 'Loading terms…' : 'Select a term'}</option>
          {terms.map((t) => (
            <option key={t.Name} value={t.Name}>{t.Name}</option>
          ))}
        </select>

        {/* School selector */}
        <select
          value={selectedSchool}
          onChange={(e) => handleSchoolChange(e.target.value)}
          disabled={!selectedTerm || schoolsLoading}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="">
            {!selectedTerm ? 'Select a term first' : schoolsLoading ? 'Loading schools…' : 'Select a school'}
          </option>
          {schools.map((s) => (
            <option key={s.Name} value={s.Name}>{s.Name}</option>
          ))}
        </select>

        {/* Course search */}
        <div className="flex gap-2">
          <div ref={searchRef} className="relative flex-1">
            <input
              type="text"
              value={courseSearch}
              onChange={(e) => {
                setCourseSearch(e.target.value)
                setSelectedCourse(null)
                setShowSuggestions(true)
              }}
              onFocus={() => setShowSuggestions(true)}
              disabled={!selectedSchool || coursesLoading}
              placeholder={
                !selectedSchool
                  ? 'Select a school first'
                  : coursesLoading
                    ? 'Loading courses…'
                    : 'Type to search courses…'
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            {showSuggestions && filteredCourses.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {filteredCourses.map((c) => (
                  <li
                    key={c.OfferingName}
                    onMouseDown={() => {
                      setSelectedCourse(c)
                      setCourseSearch(`${c.OfferingName}: ${c.Title}`)
                      setShowSuggestions(false)
                    }}
                    className="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50"
                  >
                    <span className="font-medium text-gray-800">{c.OfferingName}</span>
                    <span className="ml-2 text-gray-500">{c.Title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={handleAddCourse}
            disabled={!selectedCourse}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add
          </button>
        </div>

        {/* Added courses list */}
        {data.courses.map((course, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-800">{course.title}</span>
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
      </div>
    </div>
  )
}

// Exported for use in OnboardingPage default state
export const DEFAULT_COURSE: Course = { title: '', studyGoal: '' }
