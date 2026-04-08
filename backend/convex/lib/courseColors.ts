/**
 * Curated palette of mid-tone saturated colors for course theming.
 * Each color is chosen to remain legible at both full saturation (base)
 * and at 75% lightened (lightest subtask shade).
 */
export const COURSE_COLOR_PALETTE = [
  "#2563EB", // blue
  "#7C3AED", // violet
  "#DB2777", // pink
  "#DC2626", // red
  "#D97706", // amber
  "#059669", // emerald
  "#0891B2", // cyan
  "#9333EA", // purple
] as const;

export function randomCourseColor(): string {
  return COURSE_COLOR_PALETTE[
    Math.floor(Math.random() * COURSE_COLOR_PALETTE.length)
  ];
}
