export function getHealthColor(score: number) {
  if (score < 50) return "var(--destructive)";
  if (score < 80) return "var(--status-warning)";
  return "var(--status-success)";
}
