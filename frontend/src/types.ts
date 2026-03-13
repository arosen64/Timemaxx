import { Id } from '../../backend/convex/_generated/dataModel'

export interface Task {
  _id: Id<'tasks'>
  title: string
  description: string
  taskType: string
  timeEstimate?: number
  dueDate: number
  createdAt: number
}

export const SCHEMA_TASK_TYPES = ['Problem Set', 'Essay', 'Coding', 'Exam Prep'] as const
export type SchemaTaskType = (typeof SCHEMA_TASK_TYPES)[number]
export const TASK_TYPE_OPTIONS: SchemaTaskType[] = [...SCHEMA_TASK_TYPES]

export interface EditForm {
  title: string
  description: string
  taskType: SchemaTaskType
  dueDate: number
}

export interface Course {
  title: string
  studyGoal: string
}

export interface ProfileData {
  major: string
  year: string
  difficultSubjects: string[]
  enjoyedSubjects: string[]
  courses: Course[]
}

// Shape defined in issue #22
export interface WorkHoursData {
  [day: string]: { available: number[]; blocked: number[] }
}

// Shape defined in issue #23
export interface PreferencesData {
  traits: { [category: string]: string[] }
  focusBlockLength: number | ''
}
