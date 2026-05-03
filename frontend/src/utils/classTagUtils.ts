/**
 * Stored userCourses.title from SIS is often "OfferingName: Course title", while
 * courseCode includes a term suffix (e.g. EN.601.423.SP26). Naively joining
 * `${courseCode}: ${title}` duplicates the catalog number in the UI and breaks
 * matching. This helper keeps one catalog prefix and the human-readable name.
 */
const TERM_SUFFIX = /\.(SP|FA|SU|IN)\d{2}$/i;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripTermSuffix(courseCode: string): string {
  return courseCode.trim().replace(TERM_SUFFIX, "");
}

/** Naive concat used historically in the task modal (duplicates catalog when title already has it). */
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

/**
 * Pretty-print tags already stored with the old naive concat (catalog twice).
 * Safe no-op when the string does not match that pattern.
 */
export function formatClassTagForDisplay(tag: string): string {
  const t = tag.trim();
  const m = t.match(/^([\w.]+\.[A-Z]{2}\d{2}):\s*([\w.]+):\s*(.+)$/i);
  if (!m) return t;
  const fullCode = m[1];
  const secondSegment = m[2];
  const rest = m[3];
  const baseCatalog = stripTermSuffix(fullCode);
  if (secondSegment === baseCatalog) {
    return `${fullCode}: ${rest}`;
  }
  return t;
}
