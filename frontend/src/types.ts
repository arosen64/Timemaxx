export interface ProfileData {
  major: string
  year: string
  difficultSubjects: string[]
  enjoyedSubjects: string[]
  studyGoal: string
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
