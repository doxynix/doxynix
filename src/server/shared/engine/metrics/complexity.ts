import type { Repo } from "@prisma/client";
import ts from "typescript";

import { clamp, getFileExtension } from "../core/common";
import type { HealthScoreParams } from "../core/metrics.types";
import { MODERN_HEALTH_SCORE } from "../core/scoring-constants";

const COMPLEXITY_AST_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);

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

type LegacyHealthScoreInputs = {
  busFactor: number;
  docDensity: number;
  repo: Repo;
};

function getScriptKind(filePath: string) {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function isControlFlowNode(node: ts.Node) {
  return (
    ts.isIfStatement(node) ||
    ts.isForStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    ts.isSwitchStatement(node) ||
    ts.isCaseClause(node) ||
    ts.isCatchClause(node) ||
    ts.isConditionalExpression(node)
  );
}

function increasesNesting(node: ts.Node) {
  return (
    ts.isIfStatement(node) ||
    ts.isForStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    ts.isSwitchStatement(node) ||
    ts.isCatchClause(node)
  );
}

function calculateTypeScriptComplexity(filePath: string, content: string) {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath)
  );

  let complexity = 0;
  let maxNesting = 0;

  const visit = (node: ts.Node, nesting: number) => {
    if (isControlFlowNode(node)) {
      complexity += 1 + nesting;
      maxNesting = Math.max(maxNesting, nesting);
    }

    const nextNesting = nesting + (increasesNesting(node) ? 1 : 0);
    ts.forEachChild(node, (child) => visit(child, nextNesting));
  };

  visit(sourceFile, 0);

  return { complexity, maxNesting };
}

function calculateRegexComplexity(content: string) {
  const lines = content.split(/\r?\n/u).filter((line) => line.trim().length > 0);

  let complexity = 0;
  let maxNesting = 0;

  for (const line of lines) {
    const indentMatch = /^(\s+)/u.exec(line);
    const nesting =
      indentMatch?.[1] != null ? Math.floor(indentMatch[1].replaceAll("\t", "    ").length / 2) : 0;
    const keywordCount = Array.from(line.matchAll(CONTROL_FLOW_REGEX)).length;

    complexity += keywordCount * (1 + nesting * 0.5);
    maxNesting = Math.max(maxNesting, nesting);
  }

  return { complexity, maxNesting };
}

function shouldUseAstComplexity(filePath: string) {
  return COMPLEXITY_AST_EXTENSIONS.has(getFileExtension(filePath));
}

export function calculateComplexity(content: string, filePath: string) {
  if (shouldUseAstComplexity(filePath)) {
    return calculateTypeScriptComplexity(filePath, content);
  }

  return calculateRegexComplexity(content);
}

function isModernHealthScoreParams(input: HealthScoreParams | Repo): input is HealthScoreParams {
  return "repo" in input;
}

function calculateLegacyHealthScore(params: LegacyHealthScoreInputs) {
  const { busFactor, docDensity, repo } = params;
  let score = 50;
  const lastPushDate = repo.pushedAt == null ? new Date() : new Date(repo.pushedAt);
  const monthsSincePush = (Date.now() - lastPushDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsSincePush < 1) score += 20;
  else if (monthsSincePush > 6) score -= 30;

  if (busFactor > 2) score += 15;
  if (busFactor === 1) score -= 15;

  if (docDensity > 15) score += 15;
  if (docDensity < 5) score -= 10;

  return clamp(score, 0, 100);
}

function calculateModernHealthScore(params: HealthScoreParams) {
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

function toLegacyHealthScoreInputs(
  repo: Repo,
  legacyBusFactor?: number,
  legacyDocDensity?: number
): LegacyHealthScoreInputs {
  return {
    busFactor: legacyBusFactor ?? 0,
    docDensity: legacyDocDensity ?? 0,
    repo,
  };
}

export function calculateHealthScore(
  repoOrParams: HealthScoreParams | Repo,
  legacyBusFactor?: number,
  legacyDocDensity?: number
): number {
  if (isModernHealthScoreParams(repoOrParams)) {
    return calculateModernHealthScore(repoOrParams);
  }

  return calculateLegacyHealthScore(
    toLegacyHealthScoreInputs(repoOrParams, legacyBusFactor, legacyDocDensity)
  );
}
