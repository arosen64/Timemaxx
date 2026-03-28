import { type SchemaTaskType } from '../dashboard/types'

/** A single task being reviewed/edited before confirmation. */
export type ReviewTask = {
  id: number
  title: string
  description: string
  taskType: SchemaTaskType
  dueDate: string // MM/DD/YYYY
  /** `HH:mm` for `<input type="time" />`; default 23:59 (11:59 PM) */
  dueTime: string
}
