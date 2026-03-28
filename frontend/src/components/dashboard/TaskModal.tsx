import { useEffect, useMemo, useState } from 'react'
import { CalendarIcon } from '../icons'
import { type ClassTagCourseOption, type EditForm, CUSTOM_TASK_TYPE_OPTION, TASK_TYPE_OPTIONS } from './types'
import Modal from '../ui/Modal'
import Selector from '../ui/Selector'
import { validateDueDate } from '../../validators'

const EMPTY_CLASS_TAG_COURSES: ClassTagCourseOption[] = []

function allowedClassTagValue(raw: string, courses: ClassTagCourseOption[]): string {
  if (!raw.trim()) return ''
  const allowed = new Set(courses.map((c) => `${c.courseCode}: ${c.title}`))
  return allowed.has(raw.trim()) ? raw.trim() : ''
}

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
  /** Current-term classes; class tag may only be empty or one of these (optional field) */
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
  classTagCourses,
  onClose,
  onSubmit,
}: TaskModalProps) {
  const courses = classTagCourses ?? EMPTY_CLASS_TAG_COURSES
  const [taskName, setTaskName] = useState(initialValues.taskName)
  const [selectedType, setSelectedType] = useState(initialValues.selectedType)
  const [customTaskType, setCustomTaskType] = useState(initialValues.customTaskType)
  const [description, setDescription] = useState(initialValues.description)
  const [dueDate, setDueDate] = useState(initialValues.dueDate)
  const [classTag, setClassTag] = useState(() =>
    allowedClassTagValue(initialValues.classTag, courses)
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const classTagSelectOptions = useMemo(
    () =>
      courses.map((c) => ({
        label: `${c.courseCode}: ${c.title}`,
        value: `${c.courseCode}: ${c.title}`,
      })),
    [courses]
  )

  useEffect(() => {
    if (!isOpen) return
    setTaskName(initialValues.taskName)
    setSelectedType(initialValues.selectedType)
    setCustomTaskType(initialValues.customTaskType)
    setDescription(initialValues.description)
    setDueDate(initialValues.dueDate)
    setClassTag(allowedClassTagValue(initialValues.classTag, courses))
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
    courses,
  ])

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
        classTag: allowedClassTagValue(classTag, courses),
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

        {/* Class tag — native select like term/school on Classes page; only empty or a listed class */}
        <div className="flex w-full flex-col gap-1.5">
          <div>
            <label className="font-heading text-[13px] font-semibold text-navy">
              Class tag <span className="font-normal text-light-blue">(optional)</span>
            </label>
            {courses.length > 0 ? (
              <p className="mt-0.5 font-body text-xs text-light-blue">Choose one of your current classes, or leave blank</p>
            ) : (
              <p className="mt-0.5 font-body text-xs text-light-blue">
                Add classes for the current term on the Classes page to tag tasks
              </p>
            )}
          </div>
          {courses.length > 0 ? (
            <Selector
              className="w-full"
              value={classTag}
              onChange={setClassTag}
              options={classTagSelectOptions}
              placeholder="Select a class (optional)"
            />
          ) : (
            <div className="rounded-lg border border-border bg-bg-gray px-3 py-2 font-body text-sm text-light-blue">
              No current-term classes
            </div>
          )}
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
