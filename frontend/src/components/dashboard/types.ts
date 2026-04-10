import { Id } from '../../../../backend/convex/_generated/dataModel'
import { formatEstimatedTime } from '../../utils/timeUtils'

export type TaskType = {
  _id: Id<'tasks'>
  title: string
  description: string
  taskType: string
  timeEstimate?: number
  isManualEstimate: boolean
  estimateFeedbackRating?: 'up' | 'down'
  correctedEstimateMinutes?: number
  estimateFeedbackSubmittedAt?: number
  dueDate: number
  createdAt: number
  classTag?: string
}

export const BUILT_IN_TASK_TYPES = [
  'Essay',
  'Problem Set',
  'Exam Prep',
  'Coding',
  'Reading',
  'Lab',
  'Presentation',
] as const
export type BuiltInTaskType = (typeof BUILT_IN_TASK_TYPES)[number]
export type SchemaTaskType = BuiltInTaskType
export const CUSTOM_TASK_TYPE_OPTION = 'Other'

/** Current-term class row for the class-tag combobox (matches Classes page course search). */
export type ClassTagCourseOption = {
  courseId: Id<'userCourses'>
  courseCode: string
  title: string
  /** Canonical stored task tag (dedupes catalog when title already includes OfferingName). */
  classTag: string
}

export type EditForm = {
  title: string
  description: string
  taskType: string
  dueDate: number
  /** Set when a class tag is chosen; omit or undefined when untagged */
  courseId?: Id<'userCourses'>
  /** Empty string clears the tag on update; omit when not supported */
  classTag?: string
  /** User-supplied time estimate in minutes; undefined means let AI estimate */
  timeEstimate?: number
  /** True when user explicitly chose to reset to AI estimation */
  useAiEstimate?: boolean
}

export const TASK_TYPE_OPTIONS: BuiltInTaskType[] = [...BUILT_IN_TASK_TYPES]

export function formatDateMMDDYYYY(ms: number) {
  const d = new Date(ms)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = String(d.getFullYear())
  return `${mm}/${dd}/${yyyy}`
}

export function formatDueDateTimeDisplay(ms: number) {
  const time = new Date(ms).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${formatDateMMDDYYYY(ms)} · ${time}`
}

export function displayTitle(task: Pick<TaskType, 'title' | 'description'>) {
  const t = task.title.trim()
  if (t.length > 0) return t
  const d = task.description.trim()
  return d.length > 0 ? d : 'Untitled task'
}

export function formatMinutes(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—'
  return formatEstimatedTime(minutes)
}

export type FeedbackDraft = { rating?: 'up' | 'down'; hours: string; minutes: string }

export function parseEstimationError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const jsonMatch = raw.match(/(\{.+\})/s)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1])
      const inner = parsed?.error
      if (inner?.code && inner?.message) {
        return `Error ${inner.code}: ${inner.message}`
      }
    } catch {
      // not valid JSON — fall through
    }
  }
  return 'Failed to estimate task time. Please try again.'
}

export const BADGE_MAP: Record<string, { bg: string; text: string; label: string }> = {
  urgent: { bg: 'bg-urgent-red-light', text: 'text-urgent-red', label: 'Urgent' },
  inprogress: { bg: 'bg-info-bg', text: 'text-info-emphasis', label: 'In Progress' },
  default: { bg: 'bg-success-light', text: 'text-success', label: 'Not Started' },
}
