export const FLOATING_CARD_STAT_KEYS = [
  "apiCount",
  "changeCouplingCount",
  "churnCount",
  "configCount",
  "dependencyHotspotCount",
  "entrypointCount",
  "frameworkCount",
  "graphWarningCount",
  "hotspotCount",
  "orphanCount",
  "riskCount",
] as const;

export type FloatingCardStatKey = (typeof FLOATING_CARD_STAT_KEYS)[number];

export function activeStatKeys(stats: Record<string, number>): FloatingCardStatKey[] {
  return FLOATING_CARD_STAT_KEYS.filter((key) => {
    const value = stats[key];
    return typeof value === "number" && value > 0;
  });
}
