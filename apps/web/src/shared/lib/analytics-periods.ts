import { ANALYTICS_MAX_RANGE_DAYS } from "@doxynix/shared";

export const ANALYTICS_PERIODS = ["15m", "1h", "24h", "7d", "30d", "90d", "custom"] as const;

export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

// Everything `calculatePeriodStart` resolves on its own; `custom` reads `from`/`to` instead.
export type PresetPeriod = Exclude<AnalyticsPeriod, "custom">;

// Kept for existing importers; the value is `ANALYTICS_MAX_RANGE_DAYS` from `@doxynix/shared`.
export const MAX_CUSTOM_RANGE_DAYS = ANALYTICS_MAX_RANGE_DAYS;
