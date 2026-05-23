import { appLogger } from "@/server/core/app-logger";
import { callWithFallback } from "@/server/utils/call";
import { taskLogger } from "@/server/utils/task-logger";

import {
  aiGenerationSchema,
  isSchemaMismatchError,
  normalizeAiGenerationOutput,
} from "../engine/core/ai-result-normalize";
import type { AIResult } from "../engine/core/analysis-result.schemas";
import {
  collectArchitectPreferredPaths,
  type buildArchitectDigest,
} from "../logic/architect-digest";
import { buildStageContextPack } from "../logic/context-manager";
import { AI_MODELS, SAFETY_SETTINGS } from "./ai-constants";
import { buildAnalysisSystemPrompt, buildAnalysisUserPrompt } from "./prompts-refactored";

export async function executeArchitectPhase(
  validFiles: { content: string; path: string }[],
  documentationDigest: ReturnType<typeof buildArchitectDigest>,
  analysisId: string,
  instructions: string | undefined,
  sentinelStatus: "SAFE" | "UNSAFE",
  language: string,
  userId: number,
  repoId: string,
  branch: string
): Promise<AIResult> {
  taskLogger.info("Architect: Building final intelligence report...");

  const architectContext = await buildStageContextPack({
    files: validFiles,
    preferredPaths: collectArchitectPreferredPaths(documentationDigest),
    stage: "architect",
  });

  taskLogger.info(
    `Architect: Context assembled (${architectContext.debug.selectedTokens} tokens). Starting reasoning...`
  );

  try {
    const raw = await callWithFallback<unknown>({
      attemptMetadata: {
        analysisId,
        phase: "architect",
        promptChars: architectContext.context.length + JSON.stringify(documentationDigest).length,
      },
      models: [...AI_MODELS.POWERFUL, ...AI_MODELS.ARCHITECT, ...AI_MODELS.FALLBACK],
      outputSchema: aiGenerationSchema,
      prompt: buildAnalysisUserPrompt(
        JSON.stringify(documentationDigest),
        architectContext.context,
        instructions ?? "Focus on critical business logic and security.",
        sentinelStatus
      ),
      providerOptions: { google: { safetySettings: SAFETY_SETTINGS } },
      system: buildAnalysisSystemPrompt(language),
      taskType: "reasoning",
    });

    const aiResult = normalizeAiGenerationOutput(raw);

    taskLogger.success("Architect: Analysis complete. System patterns and risks identified.");

    appLogger.info({ analysisId, msg: "Architect stage completed with compact digest" });

    aiResult.analysisRuntime = {
      ...aiResult.analysisRuntime,
      architect: {
        source: "llm",
        status: "success",
      },
      mapper: {
        source: "llm",
        status: "success",
      },
    };

    return aiResult;
  } catch (error) {
    if (isSchemaMismatchError(error)) {
      taskLogger.warn("Architect: Using deterministic fallback after schema mismatch.");
      const fallback = normalizeAiGenerationOutput({
        executive_summary: {
          architecture_style: documentationDigest.projectMap.overview,
          purpose: documentationDigest.sections.architecture.summary.join(" "),
          stack_details: documentationDigest.metrics.languages,
        },
        findings: documentationDigest.findings.map((finding) => ({
          category: finding.category,
          confidence: 70,
          evidence: finding.evidencePaths.map((path) => ({ path })),
          id: finding.id,
          score: finding.score,
          severity: finding.severity,
          suggestedNextChange: "Review flagged area",
          summary: finding.summary,
          title: finding.title,
          whyItMatters: finding.summary,
        })),
        onboarding_guide: {
          prerequisites: ["Clone repository", "Install dependencies"],
          setup_steps: documentationDigest.sections.onboarding.summary,
        },
        repository_facts: documentationDigest.facts.map((fact) => ({
          category: fact.category,
          confidence: fact.confidence,
          detail: fact.title,
          evidence: fact.evidencePaths.map((path) => ({ path })),
          id: fact.id,
          title: fact.title,
        })),
        sections: {
          api_structure: documentationDigest.sections.api_reference.summary.join(" "),
          data_flow: documentationDigest.sections.architecture.summary.join(" "),
          security_audit: {
            risks: documentationDigest.sections.risks.summary,
            score: Math.round(documentationDigest.metrics.securityScore / 10),
          },
        },
      });

      fallback.analysisRuntime = {
        architect: { reason: "schema_mismatch_fallback", source: "llm", status: "partial" },
        mapper: { source: "llm", status: "success" },
      };

      return fallback;
    }

    taskLogger.error("Architect: Critical failure during reasoning phase.");

    appLogger.warn({
      analysisId,
      error,
      msg: "Architect stage failed",
    });
    throw error;
  }
}
