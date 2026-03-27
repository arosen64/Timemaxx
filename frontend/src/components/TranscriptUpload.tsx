import { useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { useAction, useMutation } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { type ParsedCourse } from '../../../backend/convex/actions/parseTranscript'
import { type Course } from '../types'
import FileUpload from './ui/FileUpload'
import Modal from './ui/Modal'
import Selector from './ui/Selector'
import { SpinnerIcon } from './icons'
import { STUDY_GOALS } from '../constants'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages = await Promise.all(
    Array.from({ length: pdf.numPages }, (_, i) =>
      pdf.getPage(i + 1).then((page) =>
        page.getTextContent().then((content) =>
          content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
        )
      )
    )
  )
  return pages.join('\n')
}

interface TranscriptUploadProps {
  onCoursesAdded: (courses: Course[]) => void
}

export default function TranscriptUpload({ onCoursesAdded }: TranscriptUploadProps) {
  const parseTranscript = useAction(api.actions.parseTranscript.parseTranscript)
  const addUserCourse = useMutation(api.mutations.userCourses.addUserCourse)

  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Modal state for current courses needing a study goal
  const [pendingCurrentCourses, setPendingCurrentCourses] = useState<ParsedCourse[]>([])
  const [pendingSavedPast, setPendingSavedPast] = useState<Course[]>([])
  const [pendingGoals, setPendingGoals] = useState<string[]>([])
  const [savingGoals, setSavingGoals] = useState(false)
  const [goalErrors, setGoalErrors] = useState<string[]>([])

  const handleFile = async (f: File) => {
    setFile(f)
    setError(null)
    setSummary(null)
    setParsing(true)

    try {
      const fileText = await extractPdfText(f)
      const parsed: ParsedCourse[] = await parseTranscript({ fileText })

      const pastCourses = parsed.filter((c) => c.grade && c.grade.trim().toUpperCase() !== 'X')
      const currentCourses = parsed.filter((c) => !c.grade || c.grade.trim().toUpperCase() === 'X')

      // Save past courses immediately
      const savedPast: Course[] = []
      await Promise.all(
        pastCourses.map(async (c) => {
          try {
            const userCourseId = await addUserCourse({
              courseCode: c.courseCode,
              title: c.title,
              credits: c.credits,
              term: c.term,
              grade: c.grade,
            })
            savedPast.push({
              userCourseId,
              courseCode: c.courseCode,
              title: c.title,
              credits: c.credits,
              term: c.term,
              grade: c.grade,
            })
          } catch {
            // Already exists — skip quietly
          }
        })
      )

      if (currentCourses.length === 0) {
        onCoursesAdded(savedPast)
        setSummary(`${savedPast.length} course${savedPast.length !== 1 ? 's' : ''} imported from transcript`)
      } else {
        setPendingSavedPast(savedPast)
        setPendingCurrentCourses(currentCourses)
        setPendingGoals(currentCourses.map(() => ''))
        setGoalErrors(currentCourses.map(() => ''))
      }
    } catch {
      setError('Failed to parse transcript. Please try again.')
    } finally {
      setParsing(false)
    }
  }

  const handleGoalConfirm = async () => {
    const errors = pendingGoals.map((g) => (g.trim() ? '' : 'Please select a study goal.'))
    if (errors.some(Boolean)) {
      setGoalErrors(errors)
      return
    }

    setSavingGoals(true)
    const savedCurrent: Course[] = []
    await Promise.all(
      pendingCurrentCourses.map(async (c, i) => {
        try {
          const userCourseId = await addUserCourse({
            courseCode: c.courseCode,
            title: c.title,
            credits: c.credits,
            term: c.term,
            studyGoal: pendingGoals[i],
          })
          savedCurrent.push({
            userCourseId,
            courseCode: c.courseCode,
            title: c.title,
            credits: c.credits,
            term: c.term,
            studyGoal: pendingGoals[i],
          })
        } catch {
          // Already exists — skip quietly
        }
      })
    )

    const allSaved = [...pendingSavedPast, ...savedCurrent]
    onCoursesAdded(allSaved)
    setSummary(`${allSaved.length} course${allSaved.length !== 1 ? 's' : ''} imported from transcript`)
    setPendingCurrentCourses([])
    setPendingSavedPast([])
    setPendingGoals([])
    setGoalErrors([])
    setSavingGoals(false)
  }

  const handleRemove = () => {
    setFile(null)
    setError(null)
    setSummary(null)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-1.5">
        <label className="font-heading text-sm font-semibold text-navy">Upload Transcript</label>
        <span className="font-body text-xs text-light-blue">(optional)</span>
      </div>
      <p className="font-body text-xs text-slate-blue">
        Upload your JHU transcript to auto-fill your courses
      </p>
      <p className="font-body text-xs text-light-blue">
        Note: AP, IB, and other external/transfer courses are not supported — please add those manually as equivalent JHU courses.
      </p>
      <FileUpload
        accept=".pdf"
        acceptedMimeTypes={['application/pdf']}
        maxBytes={10 * 1024 * 1024}
        hint="PDF · max 10 MB"
        file={file}
        onFile={handleFile}
        onError={(msg) => { setError(msg); setFile(null) }}
        onRemove={handleRemove}
      />
      {parsing && (
        <div className="flex items-center gap-2 font-body text-xs text-slate-blue">
          <SpinnerIcon size={12} />
          <span>Parsing transcript…</span>
        </div>
      )}
      {summary && <p className="font-body text-xs text-teal">{summary}</p>}
      {error && <p className="font-body text-xs text-urgent-red">{error}</p>}

      <Modal
        isOpen={pendingCurrentCourses.length > 0}
        onClose={() => {}}
        showCloseButton={false}
        title="Set Study Goals"
        subtitle="Select a study goal for each of your current courses."
        primaryLabel="Confirm"
        primaryLoadingLabel="Saving…"
        onPrimary={handleGoalConfirm}
        isPrimaryDisabled={savingGoals}
      >
        <div className="flex max-h-64 flex-col gap-4 overflow-y-auto">
          {pendingCurrentCourses.map((course, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <span className="font-body text-sm font-semibold text-navy">{course.title}</span>
              {course.term && (
                <span className="inline-block w-fit rounded-full bg-navy/10 px-2 py-0.5 font-body text-xs font-medium text-navy">
                  {course.term}
                </span>
              )}
              <Selector
                value={pendingGoals[i]}
                onChange={(val) => {
                  const updated = [...pendingGoals]
                  updated[i] = val
                  setPendingGoals(updated)
                  if (val) {
                    const updatedErrors = [...goalErrors]
                    updatedErrors[i] = ''
                    setGoalErrors(updatedErrors)
                  }
                }}
                placeholder="Select a study goal"
                options={STUDY_GOALS.map((g) => ({ label: g, value: g }))}
              />
              {goalErrors[i] && (
                <p className="font-body text-xs text-urgent-red">{goalErrors[i]}</p>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
