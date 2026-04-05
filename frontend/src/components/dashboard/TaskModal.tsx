import { useEffect, useMemo, useRef, useState } from 'react'
import { type ClassTagCourseOption, type EditForm, CUSTOM_TASK_TYPE_OPTION, TASK_TYPE_OPTIONS } from './types'
import DueDateRowWithCalendar from '../DueDateRowWithCalendar'
import DueTimeField from '../DueTimeField'
import Modal from '../ui/Modal'
import Selector from '../ui/Selector'
import {
  msToFormDate,
  msToDateInputValue,
  parseDueDateInput,
  parseIsoDatePickerValue,
  startOfTodayMs,
  todayDateInputMin,
  validateDueDate,
  validateDueDateAndTime,
  combineDateMsWithTime,
} from '../../validators'
import { legacyNaiveClassTag } from '../../utils/classTagUtils'

const EMPTY_CLASS_TAG_COURSES: ClassTagCourseOption[] = []

/** Map legacy duplicate-prefix tags to canonical `classTag` so the select value matches. */
function migrateClassTagToCanonical(raw: string, courses: ClassTagCourseOption[]): string {
  const t = raw.trim()
  if (!t) return ''
  for (const c of courses) {
    if (t === c.classTag) return c.classTag
    if (t === legacyNaiveClassTag(c.courseCode, c.title)) return c.classTag
  }
  return ''
}

function allowedClassTagValue(raw: string, courses: ClassTagCourseOption[]): string {
  const canonical = migrateClassTagToCanonical(raw, courses)
  const allowed = new Set(courses.map((c) => c.classTag))
  return allowed.has(canonical) ? canonical : ''
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
    dueTime: string
    classTag: string
    timeEstimate: string
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
  const [dueTime, setDueTime] = useState(initialValues.dueTime)
  const [classTag, setClassTag] = useState(() =>
    allowedClassTagValue(initialValues.classTag, courses)
  )
  const [estimateHours, setEstimateHours] = useState(() => {
    const mins = parseInt(initialValues.timeEstimate, 10)
    return isNaN(mins) ? '' : String(Math.floor(mins / 60))
  })
  const [estimateMinutes, setEstimateMinutes] = useState(() => {
    const mins = parseInt(initialValues.timeEstimate, 10)
    return isNaN(mins) ? '' : String(mins % 60)
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const datePickerRef = useRef<HTMLInputElement>(null)

  const datePickerValue = useMemo(() => {
    const ms = parseDueDateInput(dueDate)
    return ms !== null ? msToDateInputValue(ms) : ''
  }, [dueDate])

  /** Omit `min` when the shown date is already in the past so the controlled picker stays valid. */
  const datePickerMin = useMemo(() => {
    const ms = parseDueDateInput(dueDate)
    if (ms !== null && ms < startOfTodayMs()) return undefined
    return todayDateInputMin()
  }, [dueDate])

  const classTagSelectOptions = useMemo(
    () =>
      courses.map((c) => ({
        label: c.classTag,
        value: c.classTag,
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
    setDueTime(initialValues.dueTime)
    setClassTag(allowedClassTagValue(initialValues.classTag, courses))
    const mins = parseInt(initialValues.timeEstimate, 10)
    setEstimateHours(isNaN(mins) ? '' : String(Math.floor(mins / 60)))
    setEstimateMinutes(isNaN(mins) ? '' : String(mins % 60))
    setError(null)
    setSubmitting(false)
  }, [
    isOpen,
    initialValues.taskName,
    initialValues.selectedType,
    initialValues.customTaskType,
    initialValues.description,
    initialValues.dueDate,
    initialValues.dueTime,
    initialValues.classTag,
    initialValues.timeEstimate,
    courses,
  ])

  function isValidDueDate(value: string): boolean {
    const err = validateDueDate(value)
    if (err) {
      setError(err)
      return false
    }
    return true
  }

  function isValidDueDateTime(dateStr: string, timeStr: string): boolean {
    const err = validateDueDateAndTime(dateStr, timeStr)
    if (err) {
      setError(err)
      return false
    }
    return true
  }

  function handleDueDateBlur() {
    const t = dueDate.trim()
    if (!t) return
    const ms = parseDueDateInput(t)
    if (ms !== null) {
      const normalized = msToFormDate(ms)
      setDueDate(normalized)
      const err = validateDueDate(normalized)
      setError(err)
    } else {
      isValidDueDate(t)
    }
  }

  function handleNativeDateChange(iso: string) {
    if (!iso) return
    const ms = parseIsoDatePickerValue(iso)
    if (ms === null) return
    const display = msToFormDate(ms)
    setDueDate(display)
    const err = validateDueDate(display)
    setError(err)
  }

  async function handleSubmit() {
    if (!taskName.trim()) { setError('Please enter a task name.'); return }
    if (!selectedType.trim()) { setError('Please select a task type.'); return }
    const resolvedTaskType = selectedType === CUSTOM_TASK_TYPE_OPTION ? customTaskType.trim() : selectedType
    if (!resolvedTaskType) { setError('Please enter a task type.'); return }
    if (!description.trim()) { setError('Please enter a description.'); return }
    const trimmedDueDate = dueDate.trim()
    if (!trimmedDueDate) { setError('Please enter a due date.'); return }
    if (!isValidDueDateTime(trimmedDueDate, dueTime)) return

    setSubmitting(true)
    setError(null)
    try {
      const resolvedClassTag = allowedClassTagValue(classTag, courses)
      const courseId = courses.find((c) => c.classTag === resolvedClassTag)?.courseId
      const dateMidnight = parseDueDateInput(trimmedDueDate)!
      const dueMs = combineDateMsWithTime(dateMidnight, dueTime)!
      const hrs = parseInt(estimateHours, 10)
      const mins = parseInt(estimateMinutes, 10)
      const totalMinutes =
        (!isNaN(hrs) || !isNaN(mins))
          ? (isNaN(hrs) ? 0 : hrs) * 60 + (isNaN(mins) ? 0 : mins)
          : NaN
      const parsedEstimate = !isNaN(totalMinutes) && totalMinutes > 0 ? totalMinutes : undefined
      await onSubmit({
        title: taskName,
        description,
        taskType: resolvedTaskType,
        dueDate: dueMs,
        ...(courseId !== undefined ? { courseId } : {}),
        classTag: resolvedClassTag,
        ...(parsedEstimate !== undefined && !isNaN(parsedEstimate) && parsedEstimate > 0
          ? { timeEstimate: parsedEstimate }
          : {}),
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

        {/* Due date & time — default time 11:59 PM for new tasks */}
        <div className="flex w-full flex-col gap-1.5">
          <div className="font-heading text-[13px] font-semibold text-navy">Due date & time</div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block font-body text-xs font-medium text-slate-blue" htmlFor="task-due-date">
                Date
              </label>
              <DueDateRowWithCalendar
                variant="modal"
                calendarPosition="end"
                datePickerRef={datePickerRef}
                textInputId="task-due-date"
                dateTextValue={dueDate}
                onDateTextChange={setDueDate}
                onDateTextBlur={handleDueDateBlur}
                onDateTextFocus={() => setError(null)}
                placeholder="MM/DD/YYYY"
                datePickerValue={datePickerValue}
                {...(datePickerMin !== undefined ? { datePickerMin } : {})}
                onIsoChange={handleNativeDateChange}
              />
            </div>
            <DueTimeField
              variant="modal"
              id="task-due-time"
              label="Time"
              value={dueTime}
              onChange={setDueTime}
              onValueChange={() => setError(null)}
            />
          </div>
        </div>

        {/* Time estimate override */}
        <div className="flex w-full flex-col gap-1.5">
          <div>
            <label className="font-heading text-[13px] font-semibold text-navy">
              Time estimate <span className="font-normal text-light-blue">(optional)</span>
            </label>
            <p className="mt-0.5 font-body text-xs text-light-blue">Leave blank to let AI estimate</p>
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label className="font-body text-xs font-medium text-slate-blue" htmlFor="task-estimate-hours">Hours</label>
              <input
                id="task-estimate-hours"
                type="number"
                min="0"
                value={estimateHours}
                onChange={(e) => setEstimateHours(e.target.value)}
                placeholder="0"
                className="h-11 w-full rounded-md border border-border bg-bg-gray px-3.5 font-body text-sm text-navy outline-none placeholder:text-light-blue"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="font-body text-xs font-medium text-slate-blue" htmlFor="task-estimate-minutes">Minutes</label>
              <input
                id="task-estimate-minutes"
                type="number"
                min="0"
                max="59"
                value={estimateMinutes}
                onChange={(e) => setEstimateMinutes(e.target.value)}
                placeholder="0"
                className="h-11 w-full rounded-md border border-border bg-bg-gray px-3.5 font-body text-sm text-navy outline-none placeholder:text-light-blue"
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
