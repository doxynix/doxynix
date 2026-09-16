export function getDeltaColorClass(
  delta: number | null | undefined,
  reverseColor: boolean,
): string {
  if (delta == null || delta === 0) {
    return "text-muted-foreground";
  }

  if (reverseColor) {
    return delta > 0 ? "text-destructive" : "text-success";
  }

  return delta > 0 ? "text-success" : "text-destructive";
}
