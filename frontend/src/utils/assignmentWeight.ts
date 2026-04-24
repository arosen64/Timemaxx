/**
 * Converts raw user-entered points to a stored percentage (0–100).
 * Returns 0 if totalPoints is 0 or undefined to avoid division by zero.
 */
export function toAssignmentWeight(rawPoints: number, totalPoints?: number): number {
  const denominator = totalPoints ?? 100;
  if (denominator === 0) return 0;
  return (rawPoints / denominator) * 100;
}
