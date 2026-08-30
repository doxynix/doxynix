import type { HealthLevel, ScoreLabel } from "./scoring.types";

export * from "./scoring.types";

export const SCORE_THRESHOLDS = {
  CRITICAL: 50,
  HEALTHY: 80,
} as const;

/**
 * Calculates domain health tier based on numeric score (0-100).
 */
export function getHealthLevel(score: number | null | undefined): HealthLevel {
  if (score === null || score === undefined) return "unknown";
  if (score < SCORE_THRESHOLDS.CRITICAL) return "critical";
  if (score < SCORE_THRESHOLDS.HEALTHY) return "warning";
  return "healthy";
}

/**
 * Returns human-readable label for a health level or numeric score.
 */
export function getHealthLabel(scoreOrLevel: number | HealthLevel | null | undefined): ScoreLabel {
  const level: HealthLevel =
    typeof scoreOrLevel === "number" || scoreOrLevel === null || scoreOrLevel === undefined
      ? getHealthLevel(scoreOrLevel)
      : scoreOrLevel;

  switch (level) {
    case "healthy":
      return "Excellent";
    case "warning":
      return "Needs Attention";
    case "critical":
      return "Critical";
    case "unknown":
      return "No data";
  }
}
