import { useState } from 'react'
import { CalendarIcon } from '../icons'
import { type EditForm, type SchemaTaskType, TASK_TYPE_OPTIONS } from './types'
import Modal from '../ui/Modal'
import { validateDueDate } from '../../validators'

interface TaskModalProps {
  isOpen?: boolean
  title: string
  subtitle: string
  primaryLabel: string
  primaryLoadingLabel: string
  initialValues: {
    taskName: string
    selectedType: SchemaTaskType
    description: string
    dueDate: string
  }
  onClose: () => void
  onSubmit: (form: EditForm) => Promise<void>
}

export default function TaskModal({
  isOpen,
  title,
  subtitle,
  primaryLabel,
  primaryLoadingLabel,
  initialValues,
  onClose,
  onSubmit,
}: TaskModalProps) {
  const [taskName, setTaskName] = useState(initialValues.taskName)
  const [selectedType, setSelectedType] = useState<SchemaTaskType>(initialValues.selectedType)
  const [description, setDescription] = useState(initialValues.description)
  const [dueDate, setDueDate] = useState(initialValues.dueDate)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function isValidDueDate(value: string): boolean {
    const error = validateDueDate(value)
    if (error) { setError(error); return false }
    return true
  }

  async function handleSubmit() {
    if (!taskName.trim()) { setError('Please enter a task name.'); return }
    if (!TASK_TYPE_OPTIONS.includes(selectedType)) { setError('Please select a task type.'); return }
    if (!description.trim()) { setError('Please enter a description.'); return }
    const trimmedDueDate = dueDate.trim()
    if (!trimmedDueDate) { setError('Please enter a due date.'); return }
    if (!isValidDueDate(trimmedDueDate)) return

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        title: taskName,
        description,
        taskType: selectedType,
        dueDate: new Date(trimmedDueDate).getTime(),
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      error={error}
      primaryLabel={primaryLabel}
      primaryLoadingLabel={primaryLoadingLabel}
      onPrimary={handleSubmit}
      isPrimaryDisabled={submitting}
    >
      <div className="flex w-full flex-col gap-5">
        {/* Task name */}
        <div className="flex w-full flex-col gap-1.5">
          <label className="font-heading text-[13px] font-semibold text-navy">Task name</label>
          <input
            type="text"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            placeholder="e.g. Calculus Problem Set 5"
            className="h-11 w-full rounded-md border border-border bg-bg-gray px-3.5 font-body text-sm text-navy outline-none placeholder:text-light-blue"
          />
        </div>

        {/* Task type */}
        <div className="flex w-full flex-col gap-1.5">
          <label className="font-heading text-[13px] font-semibold text-navy">Task type</label>
          <div className="flex gap-2">
            {TASK_TYPE_OPTIONS.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`flex h-9 cursor-pointer items-center justify-center rounded-md px-3.5 font-body text-[13px] ${
                  selectedType === type
                    ? 'border-none bg-navy font-semibold text-white'
                    : 'border border-border bg-bg-gray font-normal text-slate-blue'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="flex w-full flex-col gap-1.5">
          <label className="font-heading text-[13px] font-semibold text-navy">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Paste or type your assignment description here..."
            className="h-24 w-full resize-none rounded-md border border-border bg-bg-gray px-3.5 py-2.5 font-body text-sm leading-normal text-navy outline-none placeholder:text-light-blue"
          />
        </div>

        {/* Due date */}
        <div className="flex w-full flex-col gap-1.5">
          <label className="font-heading text-[13px] font-semibold text-navy">Due date</label>
          <div className="flex h-11 items-center justify-between rounded-md border border-border bg-bg-gray px-3.5">
            <input
              type="text"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onBlur={() => { if (dueDate) isValidDueDate(dueDate) }}
              onFocus={() => setError(null)}
              placeholder="MM / DD / YYYY"
              className="flex-1 border-none bg-transparent font-body text-sm text-navy outline-none placeholder:text-light-blue"
            />
            <CalendarIcon />
          </div>
        </div>
      </div>
    </Modal>
  )
}
