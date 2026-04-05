/**
 * Mirrors frontend/src/utils/classTagUtils.ts so task classTag strings and
 * deleteUserCourse cascade use the same canonical format.
 */
const TERM_SUFFIX = /\.(SP|FA|SU|IN)\d{2}$/i;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripTermSuffix(courseCode: string): string {
  return courseCode.trim().replace(TERM_SUFFIX, "");
}

/** Naive concat previously used in the dashboard task modal. */
export function legacyNaiveClassTag(courseCode: string, title: string): string {
  return `${courseCode.trim()}: ${title.trim()}`;
}

export function buildClassTag(courseCode: string, title: string): string {
  const code = courseCode.trim();
  const t = title.trim();
  if (!t) return code;
  const base = stripTermSuffix(code);
  const patterns = [
    new RegExp(`^${escapeRegExp(code)}\\s*:\\s*`, "i"),
    new RegExp(`^${escapeRegExp(base)}\\s*:\\s*`, "i"),
  ];
  for (const re of patterns) {
    if (re.test(t)) {
      return `${code}: ${t.replace(re, "").trim()}`;
    }
  }
  return `${code}: ${t}`;
}

/** Maps season names to a numeric order within a year (higher = more recent). */
export const SEASON_ORDER: Record<string, number> = { Spring: 1, Summer: 2, Fall: 3 };

/** Converts a term string like "Fall 2024" to a numeric sort key (higher = more recent). */
export function termSortKey(term: string): number {
  const [season, year] = term.split(" ");
  return parseInt(year) * 10 + (SEASON_ORDER[season] ?? 0);
}

/** JHU course code pattern, e.g. "EN.601.226" */
const COURSE_CODE_RE = /[A-Z]{2}\.\d{3}\.\d{3}/g;

/**
 * Extracts the school+department prefix from a JHU course code.
 * "EN.601.433" → "EN.601"
 * Returns null if the course code doesn't match the expected format.
 */
export function parseDeptPrefix(courseCode: string): string | null {
  const parts = courseCode.split(".");
  if (parts.length < 2) return null;
  return `${parts[0]}.${parts[1]}`;
}
