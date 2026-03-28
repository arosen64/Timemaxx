import { useEffect, useId, useRef, useState } from 'react'
import { CalendarIcon } from '../icons'
import { type ClassTagCourseOption, type EditForm, CUSTOM_TASK_TYPE_OPTION, TASK_TYPE_OPTIONS } from './types'
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
    selectedType: string
    customTaskType: string
    description: string
    dueDate: string
    classTag: string
  }
  /** Current-term classes for the course-style combobox (optional) */
  classTagCourses?: ClassTagCourseOption[]
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
  classTagCourses = [],
  onClose,
  onSubmit,
}: TaskModalProps) {
  const classTagInputId = useId()
  const classTagRef = useRef<HTMLDivElement>(null)
  const [taskName, setTaskName] = useState(initialValues.taskName)
  const [selectedType, setSelectedType] = useState(initialValues.selectedType)
  const [customTaskType, setCustomTaskType] = useState(initialValues.customTaskType)
  const [description, setDescription] = useState(initialValues.description)
  const [dueDate, setDueDate] = useState(initialValues.dueDate)
  const [classTag, setClassTag] = useState(initialValues.classTag)
  const [showClassSuggestions, setShowClassSuggestions] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredClassCourses =
    classTagCourses.length === 0
      ? []
      : classTag.trim().length === 0
        ? classTagCourses.slice(0, 50)
        : classTagCourses
            .filter((c) =>
              `${c.courseCode} ${c.title}`.toLowerCase().includes(classTag.toLowerCase())
            )
            .slice(0, 50)

  useEffect(() => {
    if (!isOpen) return
    setTaskName(initialValues.taskName)
    setSelectedType(initialValues.selectedType)
    setCustomTaskType(initialValues.customTaskType)
    setDescription(initialValues.description)
    setDueDate(initialValues.dueDate)
    setClassTag(initialValues.classTag)
    setShowClassSuggestions(false)
    setError(null)
    setSubmitting(false)
  }, [
    isOpen,
    initialValues.taskName,
    initialValues.selectedType,
    initialValues.customTaskType,
    initialValues.description,
    initialValues.dueDate,
    initialValues.classTag,
  ])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (classTagRef.current && !classTagRef.current.contains(e.target as Node)) {
        setShowClassSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function isValidDueDate(value: string): boolean {
    const err = validateDueDate(value)
    if (err) { setError(err); return false }
    return true
  }

  async function handleSubmit() {
    if (!taskName.trim()) { setError('Please enter a task name.'); return }
    if (!selectedType.trim()) { setError('Please select a task type.'); return }
    const resolvedTaskType = selectedType === CUSTOM_TASK_TYPE_OPTION ? customTaskType.trim() : selectedType
    if (!resolvedTaskType) { setError('Please enter a task type.'); return }
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
        taskType: resolvedTaskType,
        dueDate: new Date(trimmedDueDate).getTime(),
        classTag: classTag.trim(),
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
          <div className="flex flex-wrap gap-2">
            {[...TASK_TYPE_OPTIONS, CUSTOM_TASK_TYPE_OPTION].map((type) => (
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
          {selectedType === CUSTOM_TASK_TYPE_OPTION && (
            <input
              type="text"
              value={customTaskType}
              onChange={(e) => setCustomTaskType(e.target.value)}
              placeholder="Enter other task type"
              className="h-11 w-full rounded-md border border-border bg-bg-gray px-3.5 font-body text-sm text-navy outline-none placeholder:text-light-blue"
            />
          )}
        </div>

        {/* Class tag — same combobox pattern as CourseSelector on Classes page */}
        <div className="flex w-full flex-col gap-1.5">
          <div>
            <label className="font-heading text-[13px] font-semibold text-navy" htmlFor={classTagInputId}>
              Class tag <span className="font-normal text-light-blue">(optional)</span>
            </label>
            {classTagCourses.length > 0 && (
              <p className="mt-0.5 font-body text-xs text-light-blue">Search your current classes or type your own</p>
            )}
          </div>
          <div ref={classTagRef} className="relative">
            <input
              id={classTagInputId}
              type="text"
              value={classTag}
              onChange={(e) => {
                setClassTag(e.target.value)
                setShowClassSuggestions(true)
              }}
              onFocus={() => setShowClassSuggestions(true)}
              placeholder={
                classTagCourses.length > 0 ? 'Type to search courses…' : 'e.g. course code or class name'
              }
              className="w-full rounded-lg border border-border bg-bg-gray px-3 py-2 font-body text-sm text-navy outline-none placeholder:text-light-blue focus:border-sky-blue focus:ring-2 focus:ring-sky-blue/20"
            />
            {showClassSuggestions && classTagCourses.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-white shadow-lg">
                {filteredClassCourses.length > 0 ? (
                  filteredClassCourses.map((c) => (
                    <li
                      key={`${c.courseCode}-${c.title}`}
                      onMouseDown={() => {
                        setClassTag(`${c.courseCode}: ${c.title}`)
                        setShowClassSuggestions(false)
                      }}
                      className="cursor-pointer px-3 py-2 font-body text-sm hover:bg-sky-blue/10"
                    >
                      <span className="font-semibold text-navy">{c.courseCode}</span>
                      <span className="ml-2 text-slate-blue">{c.title}</span>
                    </li>
                  ))
                ) : (
                  <li className="px-3 py-2 font-body text-sm text-light-blue select-none">No courses found</li>
                )}
              </ul>
            )}
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
