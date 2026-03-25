import { useState, useEffect, useRef } from 'react'
import { useAction, useMutation } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { Course } from '../types'

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
  Credits?: string
  [key: string]: unknown
}

interface CourseSelectorProps {
  onAddCourse: (course: Course) => void
}

function getCurrentTerm(date: Date): { season: string; year: number } {
  const month = date.getMonth() + 1 // 1-based
  const day = date.getDate()
  const year = date.getFullYear()

  if (month < 1 || (month === 1 && day < 15)) {
    return { season: 'Intersession', year }
  } else if (month < 6) {
    return { season: 'Spring', year }
  } else if (month < 8 || (month === 8 && day < 15)) {
    return { season: 'Summer', year }
  } else {
    return { season: 'Fall', year }
  }
}

const SEASON_ORDER = ['Intersession', 'Spring', 'Summer', 'Fall'] as const

function termToOrdinal(termName: string): number | null {
  const lower = termName.toLowerCase()
  const yearMatch = termName.match(/\d{4}/)
  if (!yearMatch) return null
  const year = parseInt(yearMatch[0], 10)
  const season =
    lower.includes('intersession') ? 'Intersession' :
    lower.includes('spring') ? 'Spring' :
    lower.includes('summer') ? 'Summer' :
    lower.includes('fall') ? 'Fall' : null
  if (!season) return null
  return year * 10 + SEASON_ORDER.indexOf(season)
}

function isPastTerm(termName: string): boolean {
  const current = getCurrentTerm(new Date())
  const currentOrdinal = current.year * 10 + SEASON_ORDER.indexOf(current.season as typeof SEASON_ORDER[number])
  const termOrdinal = termToOrdinal(termName)
  if (termOrdinal === null) return false
  return termOrdinal < currentOrdinal
}

export default function CourseSelector({ onAddCourse }: CourseSelectorProps) {
  const getAvailableTerms = useAction(api.actions.jhsCourses.getAvailableTerms)
  const getAvailableSchools = useAction(api.actions.jhsCourses.getAvailableSchools)
  const getCoursesByTerm = useAction(api.actions.jhsCourses.getCoursesByTerm)
  const addUserCourse = useMutation(api.mutations.userCourses.addUserCourse)

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

  const [studyGoalInput, setStudyGoalInput] = useState('')
  const [gradeInput, setGradeInput] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  const isCurrent = !isPastTerm(selectedTerm)

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
    setStudyGoalInput('')
    setGradeInput('')
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

  const filteredCourses =
    courseSearch.trim().length >= 2
      ? termCourses
          .filter((c) =>
            `${c.OfferingName} ${c.Title}`.toLowerCase().includes(courseSearch.toLowerCase())
          )
          .slice(0, 50)
      : []

  const handleAddCourse = async () => {
    if (!selectedCourse) return
    const courseCode = selectedCourse.OfferingName
    const title = `${selectedCourse.OfferingName}: ${selectedCourse.Title}`
    const credits = selectedCourse.Credits ? parseFloat(selectedCourse.Credits) : undefined

    try {
      const userCourseId = await addUserCourse({
        courseCode,
        title,
        credits,
        term: selectedTerm,
        studyGoal: isCurrent ? studyGoalInput.trim() || undefined : undefined,
        grade: !isCurrent ? gradeInput.trim() || undefined : undefined,
      })
      onAddCourse({
        title,
        studyGoal: isCurrent ? studyGoalInput.trim() : '',
        grade: !isCurrent ? gradeInput.trim() : undefined,
        term: selectedTerm,
        userCourseId,
      })
    } catch (err) {
      setAddError('Course already added!')
      return
    }

    setCourseSearch('')
    setSelectedCourse(null)
    setShowSuggestions(false)
    setStudyGoalInput('')
    setGradeInput('')
    setAddError(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="font-heading text-sm font-semibold text-navy">Courses</label>
        <p className="mt-0.5 font-body text-xs text-light-blue">Select a term and school, then search for courses</p>
      </div>

      {/* Term selector */}
      <select
        value={selectedTerm}
        onChange={(e) => handleTermChange(e.target.value)}
        disabled={termsLoading}
        className="rounded-lg border border-border bg-bg-gray px-3 py-2 font-body text-sm text-navy outline-none focus:border-sky-blue focus:ring-2 focus:ring-sky-blue/20 disabled:opacity-50"
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
        className="rounded-lg border border-border bg-bg-gray px-3 py-2 font-body text-sm text-navy outline-none focus:border-sky-blue focus:ring-2 focus:ring-sky-blue/20 disabled:opacity-50"
      >
        <option value="">
          {!selectedTerm ? 'Select a term first' : schoolsLoading ? 'Loading schools…' : 'Select a school'}
        </option>
        {schools.map((s) => (
          <option key={s.Name} value={s.Name}>{s.Name}</option>
        ))}
      </select>

      {/* Course search */}
      <div ref={searchRef} className="relative">
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
          className="w-full rounded-lg border border-border bg-bg-gray px-3 py-2 font-body text-sm text-navy outline-none placeholder:text-light-blue focus:border-sky-blue focus:ring-2 focus:ring-sky-blue/20 disabled:opacity-50"
        />
        {showSuggestions && filteredCourses.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-white shadow-lg">
            {filteredCourses.map((c) => (
              <li
                key={c.OfferingName}
                onMouseDown={() => {
                  setSelectedCourse(c)
                  setCourseSearch(`${c.OfferingName}: ${c.Title}`)
                  setShowSuggestions(false)
                }}
                className="cursor-pointer px-3 py-2 font-body text-sm hover:bg-sky-blue/10"
              >
                <span className="font-semibold text-navy">{c.OfferingName}</span>
                <span className="ml-2 text-slate-blue">{c.Title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Study goal or grade selector — shown once a course is selected */}
      {selectedCourse && (
        <div className="flex gap-2">
          <select
            value={isCurrent ? studyGoalInput : gradeInput}
            onChange={(e) => isCurrent ? setStudyGoalInput(e.target.value) : setGradeInput(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-bg-gray px-3 py-2 font-body text-sm text-navy outline-none focus:border-sky-blue focus:ring-2 focus:ring-sky-blue/20"
          >
            {isCurrent ? (
              <>
                <option value="">Select a study goal (optional)</option>
                {['Just pass', 'Do well', 'Ace it'].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </>
            ) : (
              <>
                <option value="">Select your grade (optional)</option>
                {['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'IP'].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </>
            )}
          </select>
          <button
            type="button"
            onClick={handleAddCourse}
            className="rounded-lg bg-navy px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-navy/90"
          >
            Add
          </button>
        </div>
      )}

      {addError && (
        <p className="font-body text-xs text-urgent-red">{addError}</p>
      )}
    </div>
  )
}
