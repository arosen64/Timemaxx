export const SEASON_ORDER = ["Intersession", "Spring", "Summer", "Fall"] as const;

export function getCurrentTerm(date: Date): { season: string; year: number } {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();

  if (month < 1 || (month === 1 && day < 15)) {
    return { season: "Intersession", year };
  } else if (month < 6) {
    return { season: "Spring", year };
  } else if (month < 8 || (month === 8 && day < 15)) {
    return { season: "Summer", year };
  } else {
    return { season: "Fall", year };
  }
}

export function termToOrdinal(termName: string): number | null {
  const lower = termName.toLowerCase();
  const yearMatch = termName.match(/\d{4}/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[0], 10);
  const season = lower.includes("intersession")
    ? "Intersession"
    : lower.includes("spring")
      ? "Spring"
      : lower.includes("summer")
        ? "Summer"
        : lower.includes("fall")
          ? "Fall"
          : null;
  if (!season) return null;
  return year * 10 + SEASON_ORDER.indexOf(season);
}

export function getCurrentTermOrdinal(date: Date): number {
  const { season, year } = getCurrentTerm(date);
  const idx = SEASON_ORDER.indexOf(season as (typeof SEASON_ORDER)[number]);
  return year * 10 + (idx === -1 ? 0 : idx);
}

export function isPastTerm(termName: string): boolean {
  const termOrdinal = termToOrdinal(termName);
  if (termOrdinal === null) return false;
  return termOrdinal < getCurrentTermOrdinal(new Date());
}
