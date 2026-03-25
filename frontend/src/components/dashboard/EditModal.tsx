import { useState } from 'react'
import { CalendarIcon } from '../icons'
import { type TaskType, type EditForm, type SchemaTaskType, TASK_TYPE_OPTIONS, formatDateMMDDYYYY } from './types'
import { Modal } from '../ui'

export default function EditModal({
  task,
  onClose,
  onSave,
}: {
  task: TaskType
  onClose: () => void
  onSave: (form: EditForm) => Promise<void>
}) {
  const [taskName, setTaskName] = useState(task.title)
  const [selectedType, setSelectedType] = useState<SchemaTaskType>(
    (TASK_TYPE_OPTIONS.includes(task.taskType as SchemaTaskType) ? task.taskType : 'Problem Set') as SchemaTaskType
  )
  const [description, setDescription] = useState(task.description)
  const [dueDate, setDueDate] = useState(formatDateMMDDYYYY(task.dueDate))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function validateDueDate(value: string): boolean {
    const match = value.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/)
    if (!match) {
      setError('Please enter a valid date in MM/DD/YYYY format.')
      return false
    }
    const [, month, day, year] = match.map(Number)
    const date = new Date(year, month - 1, day)
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      setError('Please enter a valid date in MM/DD/YYYY format.')
      return false
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (date < today) {
      setError('Due date cannot be in the past.')
      return false
    }
    return true
  }

  function handleClose() {
    setError(null)
    onClose()
  }

  async function handleSave() {
    if (!taskName.trim()) {
      setError('Please enter a task name.')
      return
    }
    if (!selectedType || !TASK_TYPE_OPTIONS.includes(selectedType)) {
      setError('Please select a task type.')
      return
    }
    if (!description.trim()) {
      setError('Please enter a description.')
      return
    }
    const trimmedDueDate = dueDate.trim()
    if (!trimmedDueDate) {
      setError('Please enter a due date.')
      return
    }
    if (!validateDueDate(trimmedDueDate)) return

    const parsedDueDate = new Date(trimmedDueDate).getTime()
    setSaving(true)
    setError(null)
    try {
      await onSave({
        title: taskName,
        description,
        taskType: selectedType,
        dueDate: parsedDueDate,
      })
      handleClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      onClose={handleClose}
      title="Edit task"
      subtitle="Update the details below."
      error={error}
      primaryLabel="Save Changes"
      primaryLoadingLabel="Saving…"
      onPrimary={handleSave}
      isPrimaryDisabled={saving}
    >
      <div className="flex flex-col w-full gap-5">
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
              onBlur={() => {
                if (dueDate) validateDueDate(dueDate)
              }}
              onFocus={() => setError(null)}
              placeholder="MM / DD / YYYY"
              className="flex-1 text-sm bg-transparent border-none outline-none font-body text-navy placeholder:text-light-blue"
            />
            <CalendarIcon />
          </div>
        </div>
      </div>
    </Modal>
  )
}
