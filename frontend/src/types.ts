export type { ExtractedTask, UploadSyllabusResult } from '../../backend/convex/lib/syllabusTypes'

//Compatible with User Courses schema in backend/convex/schema.ts
export interface Course {
  userCourseId?: string
  courseCode?: string
  title: string
  credits?: number
  term?: string
  grade?: string
  studyGoal?: string
  difficultyRating?: number
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


// From Course Selector
export interface JhuTerm {
  Name: string
  [key: string]: unknown
}

export interface JhuSchool {
  Name: string
  [key: string]: unknown
}

export interface JhuCourse {
  OfferingName: string
  Title: string
  Credits?: string
  [key: string]: unknown
}

export interface CourseSelectorProps {
  onAddCourse: (course: Course) => void
}

