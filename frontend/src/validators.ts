export function msToFormDate(ms: number): string {
  const d = new Date(ms)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}/${d.getFullYear()}`
}

/**
 * Returns an error message if the date string is invalid or in the past,
 * otherwise null. Accepts MM/DD/YYYY format.
 */
export function validateDueDate(value: string): string | null {
  const ms = formDateToMs(value)
  if (ms === null) return 'Please enter a valid date in MM/DD/YYYY format.'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (new Date(ms) < today) return 'Due date cannot be in the past.'
  return null
}

/** Returns null when the string is not a valid calendar date. */
export function formDateToMs(str: string): number | null {
  const match = str.trim().match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/)
  if (!match) return null
  const [, month, day, year] = match.map(Number)
  const d = new Date(year, month - 1, day)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  return d.getTime()
}
