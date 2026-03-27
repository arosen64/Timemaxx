import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { Id } from '../../../backend/convex/_generated/dataModel'
import { ProfileData, Course } from '../types'
import CourseSelector from './CourseSelector'
import TranscriptUpload from './TranscriptUpload'
import Button from './ui/Button'
import { GRADES, STUDY_GOALS } from '../constants'

const PAGE_SIZE = 4

interface CoursesFormProps {
  data: ProfileData
  onChange: (data: ProfileData) => void
}

export default function CoursesForm({ data, onChange }: CoursesFormProps) {
  const deleteUserCourse = useMutation(api.mutations.userCourses.deleteUserCourse)
  const updateUserCourse = useMutation(api.mutations.userCourses.updateUserCourse)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const update = <K extends keyof ProfileData>(field: K, value: ProfileData[K]) => {
    onChange({ ...data, [field]: value })
  }

  const handleAddCourse = (course: Course) => {
    if (data.courses.some((c) => c.title === course.title)) return
    onChange({ ...data, courses: [...data.courses, course] })
    setPage(0)
  }

  const handleRemoveCourse = async (index: number) => {
    const course = data.courses[index]
    if (course.userCourseId) {
      await deleteUserCourse({ userCourseId: course.userCourseId as Id<'userCourses'> })
    }
    const next = data.courses.filter((_, j) => j !== index)
    update('courses', next)
    // snap page back if last item on page was removed
    const maxPage = Math.max(0, Math.ceil(next.length / PAGE_SIZE) - 1)
    setPage((p) => Math.min(p, maxPage))
  }

  const filtered = data.courses.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-2xl font-bold text-navy">Your Classes</h2>
        <p className="mt-1 font-body text-sm text-slate-blue">
          Upload your transcript to auto-fill, or search and add courses manually.
        </p>
      </div>

      <TranscriptUpload
        onCoursesAdded={(newCourses) =>
          update('courses', [...data.courses, ...newCourses])
        }
      />

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="font-body text-xs text-light-blue">or add manually</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="flex flex-col gap-3">
        <CourseSelector onAddCourse={handleAddCourse} />

        {data.courses.length > 0 && (
          <>
            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-border" />
              <span className="font-body text-xs font-medium text-slate-blue">
                Added courses ({data.courses.length})
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder="Search added courses..."
              className="rounded-lg border border-border bg-bg-gray px-3 py-2 font-body text-sm text-navy outline-none placeholder:text-light-blue focus:border-sky-blue focus:ring-2 focus:ring-sky-blue/20"
            />

            {paged.map((course) => {
              const realIndex = data.courses.indexOf(course)
              return (
                <div key={realIndex} className="flex flex-col gap-2 rounded-lg border border-border bg-bg-gray p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-body text-sm font-semibold text-navy">{course.title}</span>
                      {course.term && (
                        <span className="inline-block w-fit rounded-full bg-navy/10 px-2 py-0.5 font-body text-xs font-medium text-navy">
                          {course.term}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCourse(realIndex)}
                      className="text-light-blue transition-colors hover:text-urgent-red"
                    >
                      ×
                    </button>
                  </div>
                  {course.grade !== undefined ? (
                    <div className="flex items-center gap-2">
                      <span className="font-body text-xs text-slate-blue">Grade:</span>
                      <select
                        value={course.grade}
                        onChange={(e) => {
                          const updated = data.courses.map((c, j) =>
                            j === realIndex ? { ...c, grade: e.target.value } : c
                          )
                          update('courses', updated)
                          if (course.userCourseId) {
                            updateUserCourse({
                              userCourseId: course.userCourseId as Id<'userCourses'>,
                              grade: e.target.value,
                            })
                          }
                        }}
                        className="rounded-lg border border-border bg-white px-2 py-1 font-body text-xs text-navy outline-none focus:border-sky-blue focus:ring-1 focus:ring-sky-blue/20"
                      >
                        <option value="">Select grade</option>
                        {GRADES.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {STUDY_GOALS.map((goal) => (
                        <label
                          key={goal}
                          className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-2 py-2 font-body text-xs font-medium transition-colors ${
                            course.studyGoal === goal
                              ? 'border-sky-blue bg-sky-blue/10 text-navy'
                              : 'border-border text-slate-blue hover:border-sky-blue/50 hover:bg-sky-blue/5'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`studyGoal-${realIndex}`}
                            value={goal}
                            checked={course.studyGoal === goal}
                            onChange={() => {
                              const updated = data.courses.map((c, j) =>
                                j === realIndex ? { ...c, studyGoal: goal } : c
                              )
                              update('courses', updated)
                              if (course.userCourseId) {
                                updateUserCourse({
                                  userCourseId: course.userCourseId as Id<'userCourses'>,
                                  studyGoal: goal,
                                })
                              }
                            }}
                            className="sr-only"
                          />
                          {goal}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {filtered.length === 0 && search && (
              <p className="text-center font-body text-sm text-light-blue">No courses match "{search}"</p>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <Button
                  variant="primary"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 0}
                  className="px-4 h-8 text-xs"
                >
                  ← Prev
                </Button>
                <span className="font-body text-xs text-light-blue">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="primary"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                  className="px-4 h-8 text-xs"
                >
                  Next →
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
