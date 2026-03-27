export const TOTAL_SLOTS = 48         // 30-min increments per day
export const SLOT_HEIGHT = 28         // px per slot
export const MAX_OFFSET_DAYS = 21
export const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** Time label shown on the left every whole hour (e.g. "9am", "12pm"). */
export function slotLabel(slot: number): string | null {
  if (slot % 2 !== 0) return null
  const h = slot / 2
  if (h === 0) return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

/** Date object for today + `days` offset. */
export function offsetDate(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

/** YYYY-MM-DD from a Date. */
export function isoDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function isToday(d: Date): boolean {
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

/** Minutes since midnight for a given Date. */
export function minutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}
