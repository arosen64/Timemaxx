import { Id } from '../../../../backend/convex/_generated/dataModel'

export type TaskType = {
  _id: Id<'tasks'>
  title: string
  description: string
  taskType: string
  timeEstimate?: number
  estimateFeedbackRating?: 'up' | 'down'
  correctedEstimateMinutes?: number
  estimateFeedbackSubmittedAt?: number
  dueDate: number
  createdAt: number
}

export const SCHEMA_TASK_TYPES = ['Problem Set', 'Essay', 'Coding', 'Exam Prep', 'Thesis'] as const
export type SchemaTaskType = (typeof SCHEMA_TASK_TYPES)[number]

export type EditForm = {
  title: string
  description: string
  taskType: SchemaTaskType
  dueDate: number
}

export const TASK_TYPE_OPTIONS: SchemaTaskType[] = [...SCHEMA_TASK_TYPES]

export function formatDateMMDDYYYY(ms: number) {
  const d = new Date(ms)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = String(d.getFullYear())
  return `${mm}/${dd}/${yyyy}`
}

export function displayTitle(task: Pick<TaskType, 'title' | 'description'>) {
  const t = task.title.trim()
  if (t.length > 0) return t
  const d = task.description.trim()
  return d.length > 0 ? d : 'Untitled task'
}
