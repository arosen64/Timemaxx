export function formatEstimatedTime(totalMinutes: number): string {
  if (totalMinutes <= 0) return "—";
  const rounded = Math.round(totalMinutes);
  if (rounded < 60) return `${rounded}m`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${h}h ${m}m`;
}
