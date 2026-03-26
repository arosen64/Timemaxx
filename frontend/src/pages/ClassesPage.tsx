import { useState } from 'react'
import { useQuery, useAction } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { Id } from '../../../backend/convex/_generated/dataModel'
import { useMutation } from 'convex/react'
import Sidebar from '../components/Sidebar'
import ClassCard from '../components/classes/ClassCard'
import CourseSelector from '../components/CourseSelector'
import { PlusIcon } from '../components/icons'

export default function ClassesPage() {
  const courses = useQuery(api.queries.userCourses.getUserCourses)
  const deleteCourse = useMutation(api.mutations.userCourses.deleteUserCourse)
  const uploadSyllabus = useAction(api.actions.uploadSyllabus.uploadSyllabus)

  const [showAddForm, setShowAddForm] = useState(false)

  async function handleRemove(userCourseId: Id<'userCourses'>) {
    await deleteCourse({ userCourseId })
  }

  async function readFileAsText(file: File): Promise<string> {
    if (file.type === 'text/plain') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsText(file)
      })
    }
    // PDF: use browser text() API as best-effort plain-text extraction
    return file.text()
  }

  function makeUploadHandlers(course: { _id: Id<'userCourses'>; title: string }) {
    return {
      onUpload: async (file: File): Promise<number> => {
        const fileText = await readFileAsText(file)
        const result = await uploadSyllabus({
          fileName: file.name,
          fileText,
          className: course.title,
        })
        return result.extractedTasks.length
      },
      onTextSubmit: async (text: string): Promise<number> => {
        const result = await uploadSyllabus({
          fileName: 'pasted-text.txt',
          fileText: text,
          className: course.title,
        })
        return result.extractedTasks.length
      },
    }
  }

  return (
    <div className="flex h-screen font-body bg-bg-gray">
      <Sidebar />

      <main className="flex flex-1 flex-col overflow-y-auto gap-8 p-10">
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
              onAddCourse={() => setShowAddForm(false)}
            />
          </div>
        )}

        {/* Course list / empty state */}
        {courses === undefined ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-xl border border-border bg-white animate-pulse" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-white py-20">
            <p className="font-heading text-lg font-bold text-navy">No classes yet</p>
            <p className="font-body text-sm text-slate-blue">
              Add your first class to get started with syllabus uploads and task extraction.
            </p>
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
            {courses.map((course) => {
              const { onUpload, onTextSubmit } = makeUploadHandlers(course)
              return (
                <ClassCard
                  key={course._id}
                  id={course._id}
                  courseCode={course.courseCode}
                  title={course.title}
                  term={course.term}
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
