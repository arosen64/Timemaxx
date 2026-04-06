/**
 * Fallback color for tasks and subtasks with no associated course.
 */
export const FALLBACK_COURSE_COLOR = "#64748B";

/**
 * Interpolates a hex color toward white by `pct` (0–1).
 * pct = 0 returns the original color; pct = 1 returns #ffffff.
 *
 * Used to compute subtask shade variants from a parent course color:
 *   step   = 1 / numSubtasks
 *   color  = mixHexWithWhite(courseColor, step * subtask.order)
 */
export function mixHexWithWhite(hex: string, pct: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const mix = (channel: number) =>
    Math.round(channel + (255 - channel) * pct);

  const toHex = (n: number) => n.toString(16).padStart(2, "0");

  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}
