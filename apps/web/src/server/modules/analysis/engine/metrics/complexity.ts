import { clamp } from "es-toolkit";

import type { HealthScoreParams } from "../core/metrics.types";
import { MODERN_HEALTH_SCORE } from "../core/scoring-constants";

/**
 * Расчет современного, глубокого показателя здоровья репозитория (Health Score).
 */
export function calculateHealthScore(params: HealthScoreParams): number {
  const {
    busFactor,
    complexityScore,
    dependencyCycles,
    docDensity,
    duplicationPercentage,
    repo,
    securityScore,
    techDebtScore,
  } = params;

  let score = 0;

  score += securityScore * MODERN_HEALTH_SCORE.securityWeight;
  score += techDebtScore * MODERN_HEALTH_SCORE.techDebtWeight;
  score += complexityScore * MODERN_HEALTH_SCORE.complexityWeight;

  score +=
    clamp(
      100 - duplicationPercentage * MODERN_HEALTH_SCORE.duplicationMultiplierForHealth,
      0,
      100
    ) * MODERN_HEALTH_SCORE.duplicationWeight;

  score +=
    clamp(docDensity * MODERN_HEALTH_SCORE.docDensityMultiplierForHealth, 0, 100) *
    MODERN_HEALTH_SCORE.documentationWeight;

  score += clamp(busFactor * 18, 0, 100) * MODERN_HEALTH_SCORE.busFactorWeight;
  score += clamp(100 - dependencyCycles * 18, 0, 100) * MODERN_HEALTH_SCORE.cyclesWeight;

  const lastPushDate = repo.pushedAt != null ? new Date(repo.pushedAt) : new Date();
  const daysSincePush = (Date.now() - lastPushDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSincePush < MODERN_HEALTH_SCORE.activityDaysThresholdRecent) {
    score += MODERN_HEALTH_SCORE.recentActivityBonus;
  } else if (daysSincePush < MODERN_HEALTH_SCORE.activityDaysThresholdActive) {
    score += MODERN_HEALTH_SCORE.activeActivityBonus;
  }

  return clamp(Math.round(score), 0, 100);
}
