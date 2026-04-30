export function msToFormDate(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/** `value` for `<input type="date" />` in local calendar (YYYY-MM-DD). */
export function msToDateInputValue(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayDateInputMin(): string {
  const t = new Date();
  return msToDateInputValue(new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime());
}

export function startOfTodayMs(): number {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t.getTime();
}

function localCalendarMs(year: number, month1: number, day: number): number | null {
  const d = new Date(year, month1 - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month1 - 1 || d.getDate() !== day) return null;
  return d.getTime();
}

/**
 * Parses MM/DD/YYYY (flexible spacing around slashes) into local midnight ms, or null.
 */
export function parseDueDateInput(str: string): number | null {
  const s = str.trim();
  if (!s) return null;
  const match = s.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/);
  if (!match) return null;
  const [, month, day, year] = match.map(Number);
  return localCalendarMs(year, month, day);
}

/** Local YYYY-MM-DD from `<input type="date" />` only — not accepted from the text field. */
export function parseIsoDatePickerValue(iso: string): number | null {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  return localCalendarMs(y, mo, d);
}

/**
 * Returns an error message if the date string is invalid or in the past,
 * otherwise null. Accepts MM/DD/YYYY only.
 */
export function validateDueDate(value: string): string | null {
  const ms = parseDueDateInput(value);
  if (ms === null) {
    return "Please enter a valid date in MM/DD/YYYY format.";
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(ms) < today) {
    return "That due date is in the past. Choose today or a future date.";
  }
  return null;
}

/** Returns null when the string is not a valid calendar date. */
export function formDateToMs(str: string): number | null {
  return parseDueDateInput(str);
}

/** Default due time (11:59 PM) — `value` for `<input type="time" />`. */
export const DEFAULT_DUE_TIME = "23:59";

export function msToTimeInputValue(ms: number): string {
  const d = new Date(ms);
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

export function parseTimeInputValue(str: string): { hours: number; minutes: number } | null {
  const m = str.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

export function combineDateMsWithTime(dateMidnightMs: number, timeHHmm: string): number | null {
  const parsed = parseTimeInputValue(timeHHmm);
  if (parsed === null) return null;
  const d = new Date(dateMidnightMs);
  d.setHours(parsed.hours, parsed.minutes, 0, 0);
  return d.getTime();
}

/**
 * Validates MM/DD/YYYY plus time; combined instant must be strictly in the future.
 */
export function validateDueDateAndTime(dateValue: string, timeValue: string): string | null {
  const dateMs = parseDueDateInput(dateValue.trim());
  if (dateMs === null) {
    return "Please enter a valid date in MM/DD/YYYY format.";
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(dateMs) < today) {
    return "That due date is in the past. Choose today or a future date.";
  }

  const t = timeValue.trim();
  if (!t) return "Please select a due time.";
  const combined = combineDateMsWithTime(dateMs, t);
  if (combined === null) return "Please enter a valid time.";
  if (combined <= Date.now()) {
    return "That due date and time are in the past. Choose a later deadline.";
  }
  return null;
}
