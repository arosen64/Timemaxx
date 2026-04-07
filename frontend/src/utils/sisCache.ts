/**
 * localStorage cache for JHU SIS API responses.
 *
 * Each entry is stored as `{ data, cachedAt }` and expires after CACHE_TTL_MS.
 * Stale entries are evicted on the next read. Write failures (e.g. storage
 * quota exceeded) are swallowed so the app degrades gracefully to live calls.
 *
 * Key schema:
 *   sis:terms                   — list of available term codes
 *   sis:schools                 — list of available schools
 *   sis:courses:{term}:{school} — course list for a specific term + school
 */

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

interface CacheEntry<T> {
  data: T
  cachedAt: number
}

/** Reads and deserializes a cache entry, returning null if missing or expired. */
function readEntry<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      localStorage.removeItem(key)
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

/** Serializes and writes a cache entry, stamping the current time as cachedAt. */
function writeEntry<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, cachedAt: Date.now() }
    localStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // Storage quota exceeded or unavailable — fail silently
  }
}

export function getCachedTerms<T>(): T | null {
  return readEntry<T>('sis:terms')
}

export function setCachedTerms<T>(data: T): void {
  writeEntry('sis:terms', data)
}

export function getCachedSchools<T>(): T | null {
  return readEntry<T>('sis:schools')
}

export function setCachedSchools<T>(data: T): void {
  writeEntry('sis:schools', data)
}

/** Returns cached courses for a specific term + school, or null if absent/stale. */
export function getCachedCourses<T>(term: string, school: string): T | null {
  return readEntry<T>(`sis:courses:${term}:${school}`)
}

export function setCachedCourses<T>(term: string, school: string, data: T): void {
  writeEntry(`sis:courses:${term}:${school}`, data)
}
