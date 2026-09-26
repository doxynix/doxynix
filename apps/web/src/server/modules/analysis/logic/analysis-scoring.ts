import type { Repo } from "@prisma/client";

import type { TeamRole } from "@/server/utils/types";

import { deriveMaintenanceStatus } from "../analysis.utils";
import type { AIResult } from "../engine/core/analysis-result.schemas";
import type { RepoMetrics } from "../engine/core/metrics.types";
import { calculateHealthScore } from "../engine/metrics/complexity";

const MAX_ONBOARDING_SCORE = 100;
const DOC_DENSITY_THRESHOLD = 10;

/**
 * Blends the AI's documentation output score with cheap hard signals (how much
 * of the repo is documented, whether it has entrypoints, config and described
 * architecture). Capped, so a strong LLM score cannot exceed a perfect 100.
 */
export function computeOnboardingScore(params: {
  docOutputScore: number;
  hardMetrics: RepoMetrics;
  repositoryFacts: NonNullable<AIResult["repository_facts"]>;
}): number {
  const { docOutputScore, hardMetrics, repositoryFacts } = params;

  return Math.min(
    MAX_ONBOARDING_SCORE,
    docOutputScore +
      (hardMetrics.docDensity > DOC_DENSITY_THRESHOLD ? 10 : 0) +
      (hardMetrics.entrypoints.length > 0 ? 15 : 0) +
      (hardMetrics.configFiles > 0 ? 10 : 0) +
      (repositoryFacts.some((fact) => fact.category === "architecture") ? 10 : 0),
  );
}

export function computeHealthScore(params: {
  busFactor: number;
  hardMetrics: RepoMetrics;
  repo: Repo;
}): number {
  const { busFactor, hardMetrics, repo } = params;

  return calculateHealthScore({
    busFactor,
    complexityScore: hardMetrics.complexityScore,
    dependencyCycles: hardMetrics.dependencyCycles.length,
    docDensity: hardMetrics.docDensity,
    duplicationPercentage: hardMetrics.duplicationReport.duplicationPercentage,
    repo,
    securityScore: hardMetrics.securityScore,
    techDebtScore: hardMetrics.techDebtScore,
  });
}

/**
 * Merges the AI result with the measured hard metrics. Static secret-like
 * findings from the scanner are promoted to `vulnerabilities` so the UI reads
 * one shape regardless of whether the finding came from the LLM or the scanner.
 */
export function buildResultToStore(params: {
  aiResult: AIResult;
  hardMetrics: RepoMetrics;
  onboardingScore: number;
  repositoryFacts: NonNullable<AIResult["repository_facts"]>;
  repositoryFindings: NonNullable<AIResult["findings"]>;
}): AIResult {
  const { aiResult, hardMetrics, onboardingScore, repositoryFacts, repositoryFindings } = params;

  return {
    ...aiResult,
    complexityScore: hardMetrics.complexityScore,
    findings: repositoryFindings,
    mostComplexFiles: hardMetrics.mostComplexFiles,
    onboardingScore,
    repository_facts: repositoryFacts,
    securityScore: hardMetrics.securityScore,
    techDebtScore: hardMetrics.techDebtScore,
    vulnerabilities: hardMetrics.securityFindings.map((finding) => ({
      description: finding.message,
      file: finding.path,
      lineHint: finding.line != null ? `line ${finding.line}` : undefined,
      risk: finding.severity === "error" ? ("HIGH" as const) : ("MODERATE" as const),
      suggestion: "Review the flagged secret-like value and replace it with a safe managed secret.",
    })),
  };
}

export function buildFinalMetrics(params: {
  busFactor: number;
  factCount: number;
  findingCount: number;
  finalHealthScore: number;
  hardMetrics: RepoMetrics;
  onboardingScore: number;
  repo: Repo;
  teamRoles: TeamRole[];
}): RepoMetrics {
  const {
    busFactor,
    factCount,
    findingCount,
    finalHealthScore,
    hardMetrics,
    onboardingScore,
    repo,
    teamRoles,
  } = params;

  return {
    ...hardMetrics,
    busFactor,
    factCount,
    findingCount,
    healthScore: finalHealthScore,
    maintenanceStatus: deriveMaintenanceStatus(repo),
    onboardingScore,
    teamRoles,
  };
}
