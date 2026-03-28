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
