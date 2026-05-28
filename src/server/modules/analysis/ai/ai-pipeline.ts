import type { DocType, Repo } from "@prisma/client";

import { taskLogger } from "@/server/modules/analysis/logic/task-logger";
import { llmLimiter } from "@/server/utils/llm-limiter";

import type { RepositoryFact, RepositoryFinding } from "@/server/utils/types";

import type { AIResult } from "../engine/core/analysis-result.schemas";
import type { RepositoryEvidence } from "../engine/core/discovery.types";
import type { RepoMetrics } from "../engine/core/metrics.types";
import { buildDocumentationInputModel } from "../engine/pipeline/documentation-input";
import { buildArchitectDigest } from "../logic/architect-digest";
import { getDocumentationInputSnapshot } from "../logic/input-retrieval";
import { executeArchitectPhase } from "./architect-stage";
import { executeMapperPhase } from "./mapper-stage";
import { executeSentinelPhase } from "./sentinel-stage";
import { orchestrateWriterTasks } from "./writer-orchestrator";

export type DeepDocsResult = {
  generatedApiMarkdown?: string;
  generatedArchitecture?: string;
  generatedChangelog?: string;
  generatedContributing?: string;
  generatedReadme?: string;
  swaggerYaml?: string;
};

/**
 * Main AI Pipeline Orchestrator
 * Coordinates Sentinel → Mapper → Architect → Writers stages
 */
export async function runAiPipeline(
  validFiles: { content: string; path: string }[],
  repositoryFacts: RepositoryFact[],
  repositoryFindings: RepositoryFinding[],
  evidence: RepositoryEvidence,
  hardMetrics: RepoMetrics,
  instructions: string | undefined,
  analysisId: string,
  language: string,
  userId: number,
  repoId: string,
  branch: string
): Promise<AIResult> {
  taskLogger.log("Initializing AI Multi-Agent Pipeline...");

  // Stage 1: Prompt injection detection (Цензор)
  const sentinelStatus = await llmLimiter.schedule(
    { id: `${analysisId}-sentinel`, weight: 5000 },
    () => executeSentinelPhase(instructions, analysisId)
  );

  if (sentinelStatus === "UNSAFE") {
    taskLogger.log("Security Sentinel: Prompt injection detected! Terminating pipeline.");
    throw new Error("Pipeline terminated due to a security violation in user instructions.");
  }
  taskLogger.success("Security Sentinel: Instructions verified as safe");

  // Stage 2: Project mapping
  taskLogger.info("Project Mapper: Scanning topology and module boundaries...");
  const projectMap = await llmLimiter.schedule({ id: `${analysisId}-mapper`, weight: 80_000 }, () =>
    executeMapperPhase(validFiles, hardMetrics, evidence, analysisId, userId, repoId, branch)
  );
  taskLogger.success(`Project Mapper: Identified ${projectMap.modules.length} core modules`);

  // Stage 3: Deep analysis & Context Assembly
  taskLogger.info("Lead Architect: Assembling context and analyzing patterns...");

  if (!hardMetrics.documentationInput) {
    hardMetrics.documentationInput = buildDocumentationInputModel(evidence, hardMetrics);
  }

  const documentationInput = getDocumentationInputSnapshot(evidence, hardMetrics);

  const architectDigest = buildArchitectDigest(
    documentationInput,
    hardMetrics,
    projectMap,
    repositoryFacts,
    repositoryFindings
  );

  taskLogger.log("Invoking Lead Architect Agent...");

  const result = await llmLimiter.schedule({ id: `${analysisId}-architect`, weight: 150_000 }, () =>
    executeArchitectPhase(
      validFiles,
      architectDigest,
      analysisId,
      instructions,
      sentinelStatus,
      language
    )
  );

  taskLogger.success("Lead Architect: Analysis complete. Intelligence report generated.");
  return result;
}

/**
 * Document Generation Pipeline
 * Coordinates parallel writer tasks for all requested documentation
 */
export async function generateDeepDocs(
  files: { content: string; path: string }[],
  analysisResult: AIResult,
  evidence: RepositoryEvidence,
  hardMetrics: RepoMetrics,
  analysisId: string,
  requestedDocs: DocType[],
  repo: Repo,
  userId: number,
  language: string
): Promise<DeepDocsResult> {
  taskLogger.info(`Documentation: Launching writers for ${requestedDocs.length} assets...`);
  const result = await orchestrateWriterTasks(
    files,
    analysisResult,
    evidence,
    hardMetrics,
    analysisId,
    requestedDocs,
    repo,
    userId,
    language
  );
  taskLogger.success("Documentation: All assets generated successfully");
  return result;
}
