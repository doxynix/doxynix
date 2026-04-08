import { type DocType, type Repo, type Status } from "@prisma/client";

import { buildArchitectDigest } from "@/server/features/analyze-repo/model/architect-digest";
import type { AIResult } from "@/server/shared/engine/core/analysis-result.schemas";
import type { RepositoryEvidence } from "@/server/shared/engine/core/discovery.types";
import type { RepoMetrics } from "@/server/shared/engine/core/metrics.types";
import type { RepositoryFact, RepositoryFinding } from "@/server/shared/types";

import { executeArchitectPhase } from "./stages/architect-stage";
import { executeMapperPhase } from "./stages/mapper-stage";
import { executeSentinelPhase } from "./stages/sentinel-stage";
import { getDocumentationInputSnapshot } from "./utils/input-retrieval";
import { buildFallbackAiResult } from "./writers/writer-fallbacks";
import { orchestrateWriterTasks } from "./writers/writer-orchestrator";

type StatusUpdater = (msg: string, percent: number, status?: Status) => Promise<void>;

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
  updateStatus: StatusUpdater,
  analysisId: string,
  language: string
): Promise<AIResult> {
  // Stage 1: Prompt injection detection
  await updateStatus("Scanning input for threats...", 40);
  const sentinelStatus = await executeSentinelPhase(instructions, analysisId);

  // Stage 2: Project mapping
  await updateStatus("Mapping project structure (Step 1/3)...", 45);
  let projectMap;
  try {
    projectMap = await executeMapperPhase(validFiles, hardMetrics, evidence, analysisId);
  } catch (error) {
    const documentationInput = getDocumentationInputSnapshot(evidence, hardMetrics);
    return buildFallbackAiResult(
      documentationInput,
      hardMetrics,
      repositoryFacts,
      repositoryFindings,
      error,
      "mapper"
    );
  }

  // Stage 3: Deep analysis
  await updateStatus("Deep Analysis & Swagger Gen (Step 2/3)...", 70);
  const documentationInput = getDocumentationInputSnapshot(evidence, hardMetrics);
  const architectDigest = buildArchitectDigest(
    documentationInput,
    hardMetrics,
    projectMap,
    repositoryFacts,
    repositoryFindings
  );

  try {
    return await executeArchitectPhase(
      validFiles,
      architectDigest,
      analysisId,
      instructions,
      sentinelStatus,
      language
    );
  } catch (error) {
    return buildFallbackAiResult(
      documentationInput,
      hardMetrics,
      repositoryFacts,
      repositoryFindings,
      error
    );
  }
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
) {
  return orchestrateWriterTasks(
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
}
