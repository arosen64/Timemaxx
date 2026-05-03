export { DAYS_OF_WEEK as DAYS_FULL } from "../../../../shared/userEnums";
export const TOTAL_SLOTS = 48; // 30-min increments per day
export const SLOT_HEIGHT = 28; // px per slot
export const MAX_OFFSET_DAYS = 21;

/** Time label shown on the left every whole hour (e.g. "9am", "12pm"). */
export function slotLabel(slot: number): string | null {
  if (slot % 2 !== 0) return null;
  const h = slot / 2;
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

/** Date object for today + `days` offset. */
export function offsetDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

/** YYYY-MM-DD from a Date (local timezone). */
export function isoDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isToday(d: Date): boolean {
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

/** Minutes since midnight for a given Date. */
export function minutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function getTextColorClass(hexColor: string): string {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "text-navy" : "text-white";
}
