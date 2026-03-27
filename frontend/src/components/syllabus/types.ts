import { type SchemaTaskType } from '../dashboard/types'

/** A single task being reviewed/edited before confirmation. */
export type ReviewTask = {
  title: string
  description: string
  taskType: SchemaTaskType
  dueDate: string // MM/DD/YYYY
}
