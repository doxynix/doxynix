export function getHealthColor(score: number) {
  if (score < 50) return "var(--destructive)";
  if (score < 80) return "var(--status-warning)";
  return "var(--status-success)";
}

export function getHealthClasses(score: number) {
  if (score < 50) return "text-destructive bg-destructive/10";
  if (score < 80) return "text-warning bg-warning/10";
  return "text-success bg-success/10";
}
