export const HEALTH_LEVELS = ["critical", "warning", "healthy", "unknown"] as const;

export type HealthLevel = (typeof HEALTH_LEVELS)[number];

export type ScoreLabel = "Critical" | "Needs Attention" | "Excellent" | "No data";
