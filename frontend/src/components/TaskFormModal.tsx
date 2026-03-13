import { useState } from 'react'
import { TaskFormData, SchemaTaskType, TASK_TYPE_OPTIONS } from '../types'
import { validateDueDateValue } from '../utils/tasks'
import { CalendarIcon } from './icons/icons'
import Modal from './Modal'
import Button from './Button'
import FormField from './FormField'
import Input from './Input'
import Textarea from './Textarea'

interface TaskFormModalProps {
  isOpen: boolean
  heading: string
  subtitle: string
  submitLabel: string
  submittingLabel: string
  initialValues?: {
    taskName?: string
    selectedType?: SchemaTaskType
    description?: string
    dueDate?: string
  }
  onClose: () => void
  /** Called with validated form values. Throw to surface an error message. */
  onSubmit: (form: TaskFormData) => Promise<void>
}

export default function TaskFormModal({
  isOpen,
  heading,
  subtitle,
  submitLabel,
  submittingLabel,
  initialValues,
  onClose,
  onSubmit,
}: TaskFormModalProps) {
  const [taskName, setTaskName] = useState(initialValues?.taskName ?? '')
  const [selectedType, setSelectedType] = useState<SchemaTaskType>(
    initialValues?.selectedType ?? 'Problem Set'
  )
  const [description, setDescription] = useState(initialValues?.description ?? '')
  const [dueDate, setDueDate] = useState(initialValues?.dueDate ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function validateDueDate(value: string): boolean {
    const msg = validateDueDateValue(value)
    if (msg) { setError(msg); return false }
    return true
  }

  function handleClose() {
    setError(null)
    onClose()
  }

  async function handleSubmit() {
    if (!taskName.trim()) { setError('Please enter a task name.'); return }
    if (!TASK_TYPE_OPTIONS.includes(selectedType)) { setError('Please select a task type.'); return }
    if (!description.trim()) { setError('Please enter a description.'); return }
    const trimmed = dueDate.trim()
    if (!trimmed) { setError('Please enter a due date.'); return }
    if (!validateDueDate(trimmed)) return

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        title: taskName,
        description,
        taskType: selectedType,
        dueDate: new Date(trimmed).getTime(),
      })
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} variant="form" onClose={handleClose}>
        {/* Header */}
        <div className="flex w-full items-center justify-between">
          <span className="font-heading text-[26px] font-bold text-navy">{heading}</span>
          <button
            onClick={handleClose}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-bg-gray font-body text-lg text-light-blue"
          >
            &times;
          </button>
        </div>

        <p className="m-0 font-body text-sm leading-normal text-slate-blue">{subtitle}</p>

        {/* Form fields */}
        <div className="flex w-full flex-col gap-5">
          <FormField label="Task name">
            <Input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g. Calculus Problem Set 5"
            />
          </FormField>

          <FormField label="Task type">
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
          </FormField>

          <FormField label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste or type your assignment description here..."
            />
          </FormField>

          <FormField label="Due date">
            <Input
              type="text"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onBlur={() => { if (dueDate) validateDueDate(dueDate) }}
              onFocus={() => setError(null)}
              placeholder="MM / DD / YYYY"
              icon={<CalendarIcon />}
            />
          </FormField>
        </div>

        {error && <p className="font-body text-sm text-red-500">{error}</p>}

        {/* Button row */}
        <div className="flex w-full gap-3">
          <Button variant="ghost" className="flex-1" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-1" disabled={submitting} onClick={handleSubmit}>
            {submitting ? submittingLabel : submitLabel}
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal" />
          </Button>
        </div>
    </Modal>
  )
}
