import { useState, useEffect } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../../backend/convex/_generated/api'
import { type Id } from '../../../../backend/convex/_generated/dataModel'
import { type GeneratedSubtask } from '../../../../backend/convex/actions/generateSubtasks'
import { mixHexWithWhite, FALLBACK_COURSE_COLOR } from '../../utils/color'
import Modal from '../ui/Modal'

interface EditableSubtask extends GeneratedSubtask {
  localId: string
}

interface SubtaskReviewModalProps {
  isOpen: boolean
  subtasks: GeneratedSubtask[]
  parentTaskId: Id<'tasks'>
  courseId?: Id<'userCourses'>
  onClose: () => void
}

export default function SubtaskReviewModal({
  isOpen,
  subtasks: initialSubtasks,
  parentTaskId,
  courseId,
  onClose,
}: SubtaskReviewModalProps) {
  const [rows, setRows] = useState<EditableSubtask[]>(() =>
    initialSubtasks.map((s, i) => ({ ...s, localId: String(i) }))
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const courses = useQuery(api.queries.userCourses.getUserCourses)
  const createSubtask = useMutation(api.mutations.subtasks.createSubtask)

  const parentColor: string = (() => {
    if (!courseId || !courses) return FALLBACK_COURSE_COLOR
    const course = courses.find((c) => c._id === courseId)
    return course?.color ?? FALLBACK_COURSE_COLOR
  })()

  function handleChange(localId: string, field: 'title' | 'description', value: string) {
    setRows((prev) =>
      prev.map((r) => (r.localId === localId ? { ...r, [field]: value } : r))
    )
  }

  function handleDelete(localId: string) {
    setRows((prev) => prev.filter((r) => r.localId !== localId))
  }

  function handleAdd() {
    const newId = String(Date.now())
    setRows((prev) => [
      ...prev,
      {
        localId: newId,
        title: '',
        description: '',
        taskType: 'Essay',
        suggestedCompletionAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    ])
  }

  async function handleConfirm() {
    const valid = rows.filter((r) => r.title.trim())
    if (valid.length === 0) {
      setError('Add at least one subtask before confirming.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const n = valid.length
      await Promise.all(
        valid.map((s, i) =>
          createSubtask({
            parentTaskId,
            title: s.title.trim(),
            description: s.description.trim() || s.title.trim(),
            taskType: s.taskType as never,
            color: mixHexWithWhite(parentColor, i / n),
            order: i,
            suggestedCompletionAt: new Date(s.suggestedCompletionAt).getTime(),
          })
        )
      )

      // Estimation is now scheduled automatically by the createSubtask mutation.
      // Estimates appear in the background via the reactive query.
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Reset rows when modal opens with new subtasks
  useEffect(() => {
    if (!isOpen) return
    setRows(initialSubtasks.map((s, i) => ({ ...s, localId: String(i) })))
    setError(null)
  }, [isOpen, parentTaskId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review subtasks"
      subtitle="Edit, remove, or add subtasks before saving."
      error={error}
      primaryLabel="Confirm subtasks"
      primaryLoadingLabel="Saving…"
      onPrimary={handleConfirm}
      isPrimaryDisabled={submitting}
    >
      <div className="flex w-full flex-col gap-3">
        {rows.map((row) => (
          <div
            key={row.localId}
            className="flex items-center gap-2 rounded-md border border-border bg-card p-3"
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <input
                type="text"
                value={row.title}
                onChange={(e) => handleChange(row.localId, 'title', e.target.value)}
                placeholder="Subtask title"
                className="h-9 w-full rounded-md border border-border bg-bg-gray px-3 font-heading text-[13px] font-semibold text-navy outline-none placeholder:text-light-blue"
              />
              <textarea
                value={row.description}
                onChange={(e) => handleChange(row.localId, 'description', e.target.value)}
                placeholder="Brief description of what to do"
                rows={2}
                className="w-full resize-none rounded-md border border-border bg-bg-gray px-3 py-2 font-body text-xs leading-normal text-navy outline-none placeholder:text-light-blue"
              />
            </div>
            <button
              onClick={() => handleDelete(row.localId)}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-border bg-bg-gray text-slate-blue hover:bg-red-50 hover:text-destructive"
              aria-label="Remove subtask"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        ))}

        <button
          onClick={handleAdd}
          className="flex h-9 w-full items-center gap-2 rounded-md border border-dashed border-border bg-bg-gray px-3 font-body text-sm text-light-blue hover:border-navy hover:text-navy"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Add subtask
        </button>
      </div>
    </Modal>
  )
}
