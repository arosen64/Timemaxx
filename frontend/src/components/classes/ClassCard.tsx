import { useState, useRef, useEffect } from 'react'
import { useMutation } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../../backend/convex/_generated/api'
import { Id } from '../../../../backend/convex/_generated/dataModel'
import { TrashIcon, SpinnerIcon, CheckCircleIcon } from '../icons'
import DifficultyRating from '../DifficultyRating'
import { GRADES, STUDY_GOALS, REMOVE_CLASS_TASKS_WARNING } from '../../constants'
import SyllabusUploadModal from './SyllabusUploadModal'


interface ClassCardProps {
  id: Id<'userCourses'>
  courseCode: string
  title: string
  term: string
  grade?: string
  studyGoal?: string
  difficultyRating?: number
  color?: string
  isPast: boolean
  hasSyllabus: boolean
  taskCount: number
  onRemove: () => Promise<void>
}

export default function ClassCard({
  id,
  courseCode,
  title,
  term,
  grade: initialGrade,
  studyGoal: initialStudyGoal,
  difficultyRating: initialDifficultyRating,
  color: initialColor,
  isPast,
  hasSyllabus,
  taskCount,
  onRemove,
}: ClassCardProps) {
  const navigate = useNavigate()
  const updateUserCourse = useMutation(api.mutations.userCourses.updateUserCourse)

  // Remove state
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  // Color picker state
  const [currentColor, setCurrentColor] = useState(initialColor ?? '')
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const colorPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!colorPickerOpen) return
    function handleMouseDown(e: MouseEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [colorPickerOpen])

  // Upload state (current cards only)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  // Grade state (past cards only)
  const saveGradeButtonRef = useRef<HTMLButtonElement>(null)
  const [gradeValue, setGradeValue] = useState(initialGrade ?? '')
  const [confirmedGrade, setConfirmedGrade] = useState(initialGrade ?? '')

  useEffect(() => {
    setConfirmedGrade(initialGrade ?? '')
    setGradeValue(initialGrade ?? '')
  }, [initialGrade])
  const [isSavingGrade, setIsSavingGrade] = useState(false)
  const [gradeSaved, setGradeSaved] = useState(false)
  const [gradeError, setGradeError] = useState<string | null>(null)

  // Study goal state (current cards only)
  const [studyGoalValue, setStudyGoalValue] = useState(initialStudyGoal ?? '')
  const [studyGoalError, setStudyGoalError] = useState<string | null>(null)

  // Difficulty rating state (past cards only)
  const [difficultyValue, setDifficultyValue] = useState(initialDifficultyRating ?? 3)
  const [difficultyError, setDifficultyError] = useState<string | null>(null)

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
      setConfirmedGrade(gradeValue)
      setGradeSaved(true)
      setTimeout(() => setGradeSaved(false), 2000)
    } catch {
      setGradeError('Failed to save grade. Please try again.')
    } finally {
      setIsSavingGrade(false)
    }
  }

  async function handleDifficultyChange(value: number) {
    setDifficultyValue(value)
    setDifficultyError(null)
    try {
      await updateUserCourse({ userCourseId: id, difficultyRating: value })
    } catch {
      setDifficultyError('Failed to save difficulty. Please try again.')
    }
  }

  async function handleStudyGoalChange(value: string) {
    if (!value) return
    setStudyGoalValue(value)
    setStudyGoalError(null)
    try {
      await updateUserCourse({ userCourseId: id, studyGoal: value })
    } catch {
      setStudyGoalError('Failed to save study goal. Please try again.')
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
            navigate('/syllabus-review', {
              state: {
                syllabusId: result.syllabusId,
                extractedTasks: result.extractedTasks,
                course: { userCourseId: id, title },
              },
            })
          }}
        />
      )}

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-white p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2 min-w-0">
            {/* Color swatch button + popover */}
            <div className="relative shrink-0 mt-1" ref={colorPickerRef}>
              <button
                type="button"
                aria-label="Set course color"
                onClick={() => setColorPickerOpen((o) => !o)}
                className={`w-4 h-4 rounded-full border border-border transition hover:opacity-70 ${currentColor ? '' : 'bg-bg-gray'}`}
                style={currentColor ? { backgroundColor: currentColor } : undefined}
              />
              {colorPickerOpen && (
                <div className="absolute left-0 top-6 z-20 flex flex-col gap-2 rounded-xl border border-border bg-white p-3 shadow-md">
                  <span className="font-body text-[10px] text-light-blue">Course color</span>
                  <input
                    type="color"
                    value={currentColor || '#002D72'}
                    className="w-10 h-10 cursor-pointer rounded-lg border border-border bg-bg-gray p-0.5"
                    onChange={async (e) => {
                      const color = e.target.value
                      setCurrentColor(color)
                      await updateUserCourse({ userCourseId: id, color })
                      setColorPickerOpen(false)
                    }}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-heading text-xs font-semibold uppercase tracking-wide text-slate-blue">
                {courseCode}
              </span>
              <h3 className="font-heading text-base font-bold text-navy truncate">{title}</h3>
              <span className="font-body text-xs text-light-blue">{term}</span>
            </div>
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
              <span className="font-body text-xs font-semibold text-navy whitespace-nowrap">Remove?</span>
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

        {confirmingRemove && (
          <div
            role="alert"
            className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 font-body text-xs leading-relaxed text-navy"
          >
            {REMOVE_CLASS_TASKS_WARNING}
            {taskCount > 0 && (
              <span className="mt-1 block font-medium text-amber-900">
                This class has {taskCount} linked task{taskCount === 1 ? '' : 's'} on your dashboard.
              </span>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="h-px w-full bg-border" />

        {/* Bottom section — syllabus upload (current) or grade editor (past) */}
        {isPast ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <select
                value={gradeValue}
                onChange={(e) => { setGradeValue(e.target.value); setGradeSaved(false); setGradeError(null) }}
                onBlur={(e) => {
                  if (e.relatedTarget === saveGradeButtonRef.current) return
                  setGradeValue(confirmedGrade)
                  setGradeError(null)
                }}
                className="flex-1 rounded-lg border border-border bg-bg-gray px-3 py-1.5 font-body text-sm text-navy outline-none focus:border-teal focus:ring-1 focus:ring-teal transition"
              >
                <option value="">Select grade…</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <button
                ref={saveGradeButtonRef}
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
            <div className="flex flex-col gap-1">
              <span className="font-body text-xs text-light-blue">Difficulty</span>
              <DifficultyRating value={difficultyValue} onChange={handleDifficultyChange} />
              {difficultyError && (
                <p className="font-body text-xs text-urgent-red">{difficultyError}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <select
              value={studyGoalValue}
              onChange={(e) => handleStudyGoalChange(e.target.value)}
              aria-label="Study goal"
              className="w-full rounded-lg border border-border bg-bg-gray px-3 py-1.5 font-body text-sm text-navy outline-none focus:border-teal focus:ring-1 focus:ring-teal transition"
            >
              <option value="">Select study goal…</option>
              {STUDY_GOALS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            {studyGoalError && (
              <p className="font-body text-xs text-urgent-red">{studyGoalError}</p>
            )}
          </div>
        )}
        {!isPast && (hasSyllabus ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-success">
              <CheckCircleIcon size={14} />
              <span className="font-body text-sm font-medium">{taskCount} tasks confirmed</span>
            </div>
            <button
              type="button"
              onClick={() => setUploadModalOpen(true)}
              className="h-7 px-2.5 rounded-lg border border-border font-heading text-xs font-semibold text-slate-blue hover:opacity-80 transition"
            >
              Re-upload
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setUploadModalOpen(true)}
              className="font-heading text-sm font-semibold text-teal hover:opacity-80 transition"
            >
              Upload Syllabus
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
