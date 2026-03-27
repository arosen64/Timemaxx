import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../../backend/convex/_generated/api'
import { Id } from '../../../../backend/convex/_generated/dataModel'
import { TrashIcon, SpinnerIcon, CheckCircleIcon } from '../icons'
import { GRADES } from '../../constants'
import SyllabusUploadModal from './SyllabusUploadModal'

export type UploadStatus = 'idle' | 'success'

interface ClassCardProps {
  id: Id<'userCourses'>
  courseCode: string
  title: string
  term: string
  grade?: string
  isPast: boolean
  onRemove: () => Promise<void>
}

export default function ClassCard({
  id,
  courseCode,
  title,
  term,
  grade: initialGrade,
  isPast,
  onRemove,
}: ClassCardProps) {
  const updateUserCourse = useMutation(api.mutations.userCourses.updateUserCourse)

  // Remove state
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  // Upload state (current cards only)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [extractedCount, setExtractedCount] = useState<number | null>(null)

  // Grade state (past cards only)
  const [gradeValue, setGradeValue] = useState(initialGrade ?? '')
  const [isSavingGrade, setIsSavingGrade] = useState(false)
  const [gradeSaved, setGradeSaved] = useState(false)
  const [gradeError, setGradeError] = useState<string | null>(null)

  async function handleConfirmRemove() {
    setIsRemoving(true)
    try {
      await onRemove()
    } finally {
      setIsRemoving(false)
      setConfirmingRemove(false)
    }
  }

  async function handleSaveGrade() {
    if (!gradeValue) {
      setGradeError('Please select a grade before saving.')
      return
    }
    setGradeError(null)
    setIsSavingGrade(true)
    try {
      await updateUserCourse({ userCourseId: id, grade: gradeValue })
      setGradeSaved(true)
      setTimeout(() => setGradeSaved(false), 2000)
    } catch {
      setGradeError('Failed to save grade. Please try again.')
    } finally {
      setIsSavingGrade(false)
    }
  }

  return (
    <>
      {!isPast && (
        <SyllabusUploadModal
          isOpen={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          course={{ userCourseId: id, title }}
          onSuccess={(result) => {
            setExtractedCount(result.extractedTasks.length)
            setUploadStatus('success')
          }}
        />
      )}

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-white p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-heading text-xs font-semibold uppercase tracking-wide text-slate-blue">
              {courseCode}
            </span>
            <h3 className="font-heading text-base font-bold text-navy truncate">{title}</h3>
            <span className="font-body text-xs text-light-blue">{term}</span>
          </div>

          {/* Remove button / inline confirmation */}
          {!confirmingRemove ? (
            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              aria-label={`Remove ${title}`}
              className="shrink-0 flex items-center justify-center h-8 w-8 rounded-lg text-light-blue hover:text-urgent-red hover:bg-bg-gray transition"
            >
              <TrashIcon size={15} />
            </button>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-body text-xs text-slate-blue whitespace-nowrap">Remove?</span>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={isRemoving}
                className="h-7 px-2.5 rounded-md bg-urgent-red font-heading text-xs font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
              >
                {isRemoving ? <SpinnerIcon size={12} /> : 'Yes'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                className="h-7 px-2.5 rounded-md border border-border font-heading text-xs font-semibold text-slate-blue hover:bg-bg-gray transition"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-border" />

        {/* Bottom section — syllabus upload (current) or grade editor (past) */}
        {isPast ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <select
                value={gradeValue}
                onChange={(e) => { setGradeValue(e.target.value); setGradeSaved(false); setGradeError(null) }}
                className="flex-1 rounded-lg border border-border bg-bg-gray px-3 py-1.5 font-body text-sm text-navy outline-none focus:border-teal focus:ring-1 focus:ring-teal transition"
              >
                <option value="">Select grade…</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSaveGrade}
                disabled={isSavingGrade}
                className="h-8 px-3 rounded-lg bg-navy font-heading text-xs font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
              >
                {isSavingGrade ? <SpinnerIcon size={12} /> : gradeSaved ? 'Saved ✓' : 'Save'}
              </button>
            </div>
            {gradeError && (
              <p className="font-body text-xs text-urgent-red">{gradeError}</p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            {uploadStatus === 'idle' && (
              <button
                type="button"
                onClick={() => setUploadModalOpen(true)}
                className="font-heading text-sm font-semibold text-teal hover:opacity-80 transition"
              >
                Upload Syllabus
              </button>
            )}
            {uploadStatus === 'success' && (
              <div className="flex items-center gap-2 text-sm font-body text-slate-blue">
                <CheckCircleIcon size={14} color="#86C8BC" />
                <span>
                  Syllabus uploaded
                  {extractedCount !== null && ` · ${extractedCount} task${extractedCount !== 1 ? 's' : ''} extracted`}
                </span>
                <button
                  type="button"
                  onClick={() => { setUploadStatus('idle'); setExtractedCount(null) }}
                  className="ml-2 font-heading text-xs font-semibold text-teal hover:opacity-80 transition"
                >
                  Upload again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
