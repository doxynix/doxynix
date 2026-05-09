import { getFileExtension } from "../../lib/path-operations";
import { clamp } from "../core/common";
import type { HealthScoreParams } from "../core/metrics.types";
import { MODERN_HEALTH_SCORE } from "../core/scoring-constants";
import { TREE_SITTER_SUPPORTED_EXTENSIONS } from "../extractors/tree-sitter-signals";

const TS_EXTENSIONS = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);

const ONE_C_KEYWORDS = [
  "\\u0415\\u0441\\u043B\\u0438",
  "\\u0418\\u043D\\u0430\\u0447\\u0435",
  "\\u0414\\u043B\\u044F",
  "\\u041A\\u0430\\u0436\\u0434\\u043E\\u0433\\u043E",
  "\\u041F\\u043E\\u043A\\u0430",
  "\\u041F\\u043E\\u043F\\u044B\\u0442\\u043A\\u0430",
  "\\u0418\\u0441\\u043A\\u043B\\u044E\\u0447\\u0435\\u043D\\u0438\\u0435",
];

const CONTROL_FLOW_REGEX = new RegExp(
  `\\b(if|else|elif|for|foreach|while|switch|case|catch|finally|break|continue|default|goto|try|except|rescue|unless|when|${ONE_C_KEYWORDS.join("|")})\\b`,
  "giu"
);

function calculateRegexComplexity(content: string) {
  const lines = content.split(/\r?\n/u).filter((line) => line.trim().length > 0);

  let complexity = 0;
  let maxNesting = 0;

  for (const line of lines) {
    const indentMatch = /^(\s+)/u.exec(line);
    let nesting = 0;

    if (indentMatch?.[1] != null) {
      const indentStr = indentMatch[1].replaceAll("\t", "    ");
      nesting = Math.floor(indentStr.length / 4); // Делим на 4 (стандарт)
    }

    const keywordCount = Array.from(line.matchAll(CONTROL_FLOW_REGEX)).length;

    if (keywordCount > 0) {
      complexity += keywordCount * (1 + nesting * 0.5);
      maxNesting = Math.max(maxNesting, nesting);
    }
  }

  return { complexity, maxNesting };
}

/**
 * Резервный расчет сложности (Regex-Fallback).
 */
export function calculateComplexity(content: string, filePath: string) {
  const ext = getFileExtension(filePath);

  const isSupportedByAst = TS_EXTENSIONS.has(ext) || TREE_SITTER_SUPPORTED_EXTENSIONS.includes(ext);

  if (isSupportedByAst) {
    return { complexity: 0, maxNesting: 0 };
  }

  return calculateRegexComplexity(content);
}

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
