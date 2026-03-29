import { useState, useEffect, useRef } from 'react'
import { useAction, useMutation } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { JhuCourse, JhuSchool, JhuTerm, CourseSelectorProps } from '../types'
import { GRADES, STUDY_GOALS } from '../constants'
import { isPastTerm } from '../utils/termUtils'
import Selector from './ui/Selector'
import Button from './ui/Button'
import DifficultyRating from './DifficultyRating'

export default function CourseSelector({ onAddCourse, mode = 'all' }: CourseSelectorProps) {
  const getAvailableTerms = useAction(api.actions.jhuCourses.getAvailableTerms)
  const getAvailableSchools = useAction(api.actions.jhuCourses.getAvailableSchools)
  const getCoursesByTerm = useAction(api.actions.jhuCourses.getCoursesByTerm)
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
  const [difficultyInput, setDifficultyInput] = useState(3)
  const [addError, setAddError] = useState<string | null>(null)

  const isCurrent = !isPastTerm(selectedTerm)

  useEffect(() => {
    setTermsLoading(true)
    getAvailableTerms({})
      .then((res) => {
        let filtered = res as JhuTerm[]
        if (mode === 'current') filtered = filtered.filter((t) => !isPastTerm(t.Name))
        if (mode === 'past') filtered = filtered.filter((t) => isPastTerm(t.Name))
        setTerms(filtered)
      })
      .catch(() => setTerms([]))
      .finally(() => setTermsLoading(false))
  }, [getAvailableTerms, mode])

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
    setDifficultyInput(3)
    setAddError(null)
  }

  const handleSchoolChange = (school: string) => {
    setSelectedSchool(school)
    setTermCourses([])
    setCourseSearch('')
    setSelectedCourse(null)
    setAddError(null)
    if (!school || !selectedTerm) return
    setCoursesLoading(true)
    getCoursesByTerm({ term: selectedTerm, school })
      .then((res) => setTermCourses(res as JhuCourse[]))
      .catch(() => setTermCourses([]))
      .finally(() => setCoursesLoading(false))
  }

  const seenCodes = new Set<string>()
  const uniqueCourses = termCourses.filter((c) => {
    if (seenCodes.has(c.OfferingName)) return false
    seenCodes.add(c.OfferingName)
    return true
  })

  const filteredCourses =
    courseSearch.trim().length === 0
      ? uniqueCourses.slice(0, 50)
      : uniqueCourses
          .filter((c) =>
            `${c.OfferingName} ${c.Title}`.toLowerCase().includes(courseSearch.toLowerCase())
          )
          .slice(0, 50)

  const handleAddCourse = async () => {
    if (!selectedCourse) return
    if (isCurrent && !studyGoalInput.trim()) {
      setAddError('Please select a study goal.')
      return
    }
    if (!isCurrent && !gradeInput.trim()) {
      setAddError('Please select a grade.')
      return
    }
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
        difficultyRating: !isCurrent ? difficultyInput : undefined,
      })
      onAddCourse({
        title,
        studyGoal: isCurrent ? studyGoalInput.trim() : '',
        grade: !isCurrent ? gradeInput.trim() : undefined,
        term: selectedTerm,
        userCourseId,
        difficultyRating: !isCurrent ? difficultyInput : undefined,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('COURSE_ALREADY_EXISTS')) {
        setAddError('You have already added this course.')
      } else if (message.includes('Unauthenticated') || message.includes('Not authenticated')) {
        setAddError('You must be signed in to add courses.')
      } else {
        setAddError('Failed to add course. Please try again.')
      }
      setGradeInput('')
      return
    }

    setCourseSearch('')
    setSelectedCourse(null)
    setShowSuggestions(false)
    setStudyGoalInput('')
    setGradeInput('')
    setDifficultyInput(3)
    setAddError(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="font-heading text-sm font-semibold text-navy">Courses</label>
        <p className="mt-0.5 font-body text-xs text-light-blue">Select a term and school, then search for courses</p>
      </div>

      <Selector
  value={selectedTerm}
  onChange={handleTermChange}
  options={terms.map((t) => ({ label: t.Name, value: t.Name }))}
  placeholder={!termsLoading && terms.length === 0 ? 'No terms available' : 'Select a term'}
  disabled={!termsLoading && terms.length === 0}
  loading={termsLoading}
  loadingText="Loading terms…"
/>

      {/* School selector */}
      <Selector
  value={selectedSchool}
  onChange={handleSchoolChange}
  options={schools.map((s) => ({ label: s.Name, value: s.Name }))}
  placeholder="Select a school"
  loading={schoolsLoading}
  loadingText="Loading schools…"
  disabled={!selectedTerm}
/>

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
        {showSuggestions && selectedSchool && !coursesLoading && (
          <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-white shadow-lg">
            {filteredCourses.length > 0 ? (
              filteredCourses.map((c, i) => (
                <li
                  key={`${c.OfferingName}-${i}`}
                  onMouseDown={() => {
                    setSelectedCourse(c)
                    setCourseSearch(`${c.OfferingName}: ${c.Title}`)
                    setShowSuggestions(false)
                    setAddError(null)
                  }}
                  className="cursor-pointer px-3 py-2 font-body text-sm hover:bg-sky-blue/10"
                >
                  <span className="font-semibold text-navy">{c.OfferingName}</span>
                  <span className="ml-2 text-slate-blue">{c.Title}</span>
                </li>
              ))
            ) : (
              <li className="px-3 py-2 font-body text-sm text-light-blue select-none">
                No courses found
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Study goal or grade selector — shown once a course is selected */}
      {selectedCourse && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Selector
              className="flex-1"
              value={isCurrent ? studyGoalInput : gradeInput}
              onChange={isCurrent ? setStudyGoalInput : setGradeInput}
              placeholder={isCurrent ? 'Select a study goal' : 'Select your grade'}
              options={
                isCurrent
                  ? STUDY_GOALS.map((g) => ({ label: g, value: g }))
                  : GRADES.map((g) => ({ label: g, value: g }))
              }
            />
            {isCurrent && (
              <Button variant="primary" onClick={handleAddCourse} className="px-4">
                Add
              </Button>
            )}
          </div>
          {!isCurrent && (
            <div className="flex items-center gap-2">
              <DifficultyRating value={difficultyInput} onChange={setDifficultyInput} />
              <Button variant="primary" onClick={handleAddCourse} className="ml-auto px-4">
                Add
              </Button>
            </div>
          )}
        </div>
      )}

      {addError && (
        <p className="font-body text-xs text-urgent-red">{addError}</p>
      )}
    </div>
  )
}
