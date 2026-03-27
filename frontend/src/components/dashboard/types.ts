import { Id } from '../../../../backend/convex/_generated/dataModel'

export type TaskType = {
  _id: Id<'tasks'>
  title: string
  description: string
  taskType: string
  timeEstimate?: number
  dueDate: number
  createdAt: number
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
export const CUSTOM_TASK_TYPE_OPTION = 'Other'

export type EditForm = {
  title: string
  description: string
  taskType: string
  dueDate: number
}

export const TASK_TYPE_OPTIONS: BuiltInTaskType[] = [...BUILT_IN_TASK_TYPES]

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
