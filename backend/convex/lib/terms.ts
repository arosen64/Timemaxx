/** Hopkins-style term strings → sortable ordinals (shared by HTTP chat and entity resolution). */

export function termToOrdinal(termName: string): number | null {
  const lower = termName.toLowerCase();
  const yearMatch = termName.match(/\d{4}/);
  if (!yearMatch) return null;
  const year = Number.parseInt(yearMatch[0], 10);
  const season =
    lower.includes("intersession") ? 0
    : lower.includes("spring") ? 1
    : lower.includes("summer") ? 2
    : lower.includes("fall") ? 3
    : null;
  if (season === null) return null;
  return year * 10 + season;
}

export function currentTermOrdinal(date = new Date()): number {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  const season =
    month === 1 && day < 15 ? 0
    : month < 6 ? 1
    : month < 8 || (month === 8 && day < 15) ? 2
    : 3;
  return year * 10 + season;
}

export function isPastTerm(termName: string): boolean {
  const ordinal = termToOrdinal(termName);
  if (ordinal === null) return false;
  return ordinal < currentTermOrdinal();
}

export type TermBucket = 0 | 1 | 2 | 3;

/** For course search ranking: current → future → past → unknown. */
export function termBucket(term: string | undefined): TermBucket {
  if (!term) return 3;
  const ord = termToOrdinal(term);
  if (ord === null) return 3;
  const now = currentTermOrdinal();
  if (ord === now) return 0;
  if (ord > now) return 1;
  return 2;
}
