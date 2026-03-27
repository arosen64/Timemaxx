import { useState } from 'react'
import { useQuery, useAction, useMutation } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { Id } from '../../../backend/convex/_generated/dataModel'
import { extractPdfText } from '../utils/pdf'
import Sidebar from '../components/Sidebar'
import ClassCard from '../components/classes/ClassCard'
import CourseSelector from '../components/CourseSelector'
import { PlusIcon } from '../components/icons'
import { isPastTerm } from '../utils/termUtils'

export default function ClassesPage() {
  const courses = useQuery(api.queries.userCourses.getUserCourses)
  const deleteCourse = useMutation(api.mutations.userCourses.deleteUserCourse)
  const uploadSyllabus = useAction(api.actions.uploadSyllabus.uploadSyllabus)

  const [activeTab, setActiveTab] = useState<'current' | 'past'>('current')
  const [showAddForm, setShowAddForm] = useState(false)

  const currentCourses = courses?.filter((c) => !isPastTerm(c.term ?? '')) ?? []
  const pastCourses = courses?.filter((c) => isPastTerm(c.term ?? '')) ?? []
  const tabCourses = activeTab === 'current' ? currentCourses : pastCourses

  async function handleRemove(userCourseId: Id<'userCourses'>) {
    await deleteCourse({ userCourseId })
  }

  async function readFileAsText(file: File): Promise<string> {
    if (file.type === 'application/pdf') {
      return extractPdfText(file)
    }
    return file.text()
  }

  function makeUploadHandlers(course: { _id: Id<'userCourses'>; title: string }) {
    return {
      onUpload: async (file: File): Promise<number> => {
        const fileContents = await readFileAsText(file)
        const result = await uploadSyllabus({
          fileContents,
          courseId: course._id,
        })
        return result.extractedTasks.length
      },
      onTextSubmit: async (text: string): Promise<number> => {
        const result = await uploadSyllabus({
          fileContents: text,
          courseId: course._id,
        })
        return result.extractedTasks.length
      },
    }
  }

  return (
    <div className="flex h-screen font-body bg-bg-gray">
      <Sidebar />

      <main className="flex flex-1 flex-col overflow-y-auto gap-6 p-10">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-3xl font-bold text-navy">Classes</h1>
            <p className="font-body text-sm text-slate-blue">Manage your classes and syllabi</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-2 h-10 px-4 rounded-lg bg-navy font-heading text-sm font-semibold text-white hover:opacity-90 transition"
          >
            <PlusIcon size={15} />
            Add Class
          </button>
        </div>

        {/* Add Course Panel */}
        {showAddForm && (
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-base font-bold text-navy">Add a New Class</h2>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="font-body text-sm text-slate-blue hover:text-navy transition"
              >
                Cancel
              </button>
            </div>
            <CourseSelector
              mode={activeTab}
              onAddCourse={() => setShowAddForm(false)}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {(['current', 'past'] as const).map((tab) => {
            const count = courses === undefined ? null : tab === 'current' ? currentCourses.length : pastCourses.length
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`pb-2 px-4 font-heading text-sm font-semibold capitalize transition border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'border-navy text-navy'
                    : 'border-transparent text-slate-blue hover:text-navy'
                }`}
              >
                {tab}
                {count !== null && (
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 font-body text-xs ${
                    activeTab === tab ? 'bg-navy text-white' : 'bg-bg-gray text-slate-blue'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Course list / empty state */}
        {courses === undefined ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-xl border border-border bg-white animate-pulse" />
            ))}
          </div>
        ) : tabCourses.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-white py-20">
            {activeTab === 'current' ? (
              <>
                <p className="font-heading text-lg font-bold text-navy">No current classes</p>
                <p className="font-body text-sm text-slate-blue">
                  Add a class you're taking this semester to upload its syllabus.
                </p>
              </>
            ) : (
              <>
                <p className="font-heading text-lg font-bold text-navy">No past classes</p>
                <p className="font-body text-sm text-slate-blue">
                  Add classes you've completed to record your grades.
                </p>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="mt-2 flex items-center gap-2 h-10 px-4 rounded-lg bg-navy font-heading text-sm font-semibold text-white hover:opacity-90 transition"
            >
              <PlusIcon size={15} />
              Add Class
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {tabCourses.map((course) => {
              const { onUpload, onTextSubmit } = makeUploadHandlers(course)
              return (
                <ClassCard
                  key={course._id}
                  id={course._id}
                  courseCode={course.courseCode}
                  title={course.title}
                  term={course.term ?? ''}
                  grade={course.grade}
                  isPast={activeTab === 'past'}
                  onRemove={() => handleRemove(course._id)}
                  onUpload={onUpload}
                  onTextSubmit={onTextSubmit}
                />
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
