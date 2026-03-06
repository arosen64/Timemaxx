import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'

const TASK_TYPES = ['Problem Set', 'Essay', 'Coding', 'Exam Prep'] as const
type TaskType = typeof TASK_TYPES[number]

interface AddTaskModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AddTaskModal({ isOpen, onClose }: AddTaskModalProps) {
  const [taskName, setTaskName] = useState('')
  const [selectedType, setSelectedType] = useState<TaskType>('Problem Set')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createTask = useMutation(api.mutations.tasks.createTask)

  function validateDueDate(value: string): boolean {
    const match = value.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/)
    if (!match) return false
    const [, month, day, year] = match.map(Number)
    const date = new Date(year, month - 1, day)
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  }

  async function handleSubmit() {
    if (!taskName.trim()) return
    if (!dueDate || !validateDueDate(dueDate)) {
      setError('Please enter a valid date in MM/DD/YYYY format.')
      return
    }
    const parsedDueDate = new Date(dueDate).getTime()
    setIsSubmitting(true)
    setError(null)
    try {
      await createTask({
        title: taskName,
        description,
        taskType: selectedType,
        dueDate: parsedDueDate,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/30"
      onClick={onClose}
    >
      <div
        className="flex w-[520px] flex-col gap-6 rounded-xl border border-border bg-white p-12"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex w-full items-center justify-between">
          <span className="font-heading text-[26px] font-bold text-navy">Add new task</span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-bg-gray font-body text-lg text-light-blue"
          >
            &times;
          </button>
        </div>

        {/* Subtitle */}
        <p className="m-0 font-body text-sm leading-normal text-slate-blue">
          Fill in the details below.
        </p>

        {/* Form Body */}
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
              {TASK_TYPES.map((type) => (
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
                  if (dueDate && !validateDueDate(dueDate)) {
                    setError('Please enter a valid date in MM/DD/YYYY format.')
                  }
                }}
                onFocus={() => setError(null)}
                placeholder="MM / DD / YYYY"
                className="flex-1 border-none bg-transparent font-body text-sm text-navy outline-none placeholder:text-light-blue"
              />
              <CalendarIcon />
            </div>
          </div>
        </div>

        {error && (
          <p className="font-body text-sm text-red-500">{error}</p>
        )}

        {/* Button Row */}
        <div className="flex w-full gap-3">
          <button
            onClick={onClose}
            className="flex h-12 flex-1 cursor-pointer items-center justify-center rounded-lg border border-border bg-bg-gray font-heading text-[15px] font-semibold text-slate-blue"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !taskName.trim() || !dueDate}
            className="flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-none bg-navy font-heading text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Adding…' : 'Add Task'}
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal" />
          </button>
        </div>
      </div>
    </div>
  )
}

function CalendarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="stroke-light-blue"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}
