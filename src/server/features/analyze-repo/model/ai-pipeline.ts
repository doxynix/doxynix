import type { DocType, Repo } from "@prisma/client";

import type { AIResult } from "@/server/shared/engine/core/analysis-result.schemas";
import type { RepositoryEvidence } from "@/server/shared/engine/core/discovery.types";
import type { RepoMetrics } from "@/server/shared/engine/core/metrics.types";
import { buildDocumentationInputModel } from "@/server/shared/engine/pipeline/documentation-input";
import { taskLogger } from "@/server/shared/lib/task-logger";
import type { RepositoryFact, RepositoryFinding } from "@/server/shared/types";

import { buildArchitectDigest } from "./architect-digest";
import { executeArchitectPhase } from "./stages/architect-stage";
import { executeMapperPhase } from "./stages/mapper-stage";
import { executeSentinelPhase } from "./stages/sentinel-stage";
import { getDocumentationInputSnapshot } from "./utils/input-retrieval";
import { orchestrateWriterTasks } from "./writers/writer-orchestrator";

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
  const sentinelStatus = await executeSentinelPhase(instructions, analysisId);

  if (sentinelStatus === "UNSAFE") {
    taskLogger.log("Security Sentinel: Prompt injection detected! Terminating pipeline.");
    throw new Error("Pipeline terminated due to a security violation in user instructions.");
  }
  taskLogger.success("Security Sentinel: Instructions verified as safe");

  // Stage 2: Project mapping
  taskLogger.info("Project Mapper: Scanning topology and module boundaries...");
  const projectMap = await executeMapperPhase(
    validFiles,
    hardMetrics,
    evidence,
    analysisId,
    userId,
    repoId,
    branch
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
  const result = await executeArchitectPhase(
    validFiles,
    architectDigest,
    analysisId,
    instructions,
    sentinelStatus,
    language,
    userId,
    repoId,
    branch
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
