/**
 * Converts raw user-entered points to a stored percentage.
 * - Returns 0 if totalPoints is 0 (division-by-zero guard).
 * - Clamps negative results to 0.
 * - Values above 100 are allowed (extra-credit assignments).
 * - Returns 0 for NaN inputs.
 */
export function toAssignmentWeight(rawPoints: number, totalPoints?: number): number {
  if (!isFinite(rawPoints)) return 0;
  const denominator = totalPoints ?? 100;
  if (denominator === 0) return 0;
  return Math.max(0, (rawPoints / denominator) * 100);
}
