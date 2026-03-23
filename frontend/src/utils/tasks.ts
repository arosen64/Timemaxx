import { Task } from '../types'

/**
 * Converts a raw minute count to a human-readable string (e.g. "45 mins", "—"). 
 */
export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—'
  if (minutes === 1) return '1 min'
  return `${Math.round(minutes)} mins`
}

/**
 * Formats an epoch-ms timestamp as "MM/DD/YYYY". 
 */
export function formatDateMMDDYYYY(ms: number): string {
  const d = new Date(ms)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = String(d.getFullYear())
  return `${mm}/${dd}/${yyyy}`
}

/**
 * Returns the best display title for a task: title → description → "Untitled task".
 */
export function displayTitle(task: Pick<Task, 'title' | 'description'>): string {
  const t = task.title.trim()
  if (t.length > 0) return t
  const d = task.description.trim()
  return d.length > 0 ? d : 'Untitled task'
}

/**
 * Validates a due-date string in MM/DD/YYYY format.
 * Returns an error message string if invalid, or null if the date is valid.
 */
export function validateDueDateValue(value: string): string | null {
  const match = value.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/)
  if (!match) return 'Please enter a valid date in MM/DD/YYYY format.'

  const [, month, day, year] = match.map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return 'Please enter a valid date in MM/DD/YYYY format.'
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (date < today) return 'Due date cannot be in the past.'
  return null
}
