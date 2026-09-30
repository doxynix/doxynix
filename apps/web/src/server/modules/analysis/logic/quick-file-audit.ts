import type * as z from "zod";

import { getActiveModels } from "@/server/core/ai/ai-constants";
import { buildRepositoryToolProfile } from "@/server/core/ai/ai-tools";
import { callWithFallback } from "@/server/utils/call";
import { CodeOptimizer } from "@/server/utils/optimizers";

import { buildSingleFileAnalysisPrompt } from "../ai/prompts-refactored";
import {
  type FileActionInput,
  type QuickFileAuditResult,
  QuickFileAuditSchema,
} from "../analysis.schemas";
import {
  buildAuditFallback,
  buildContextPromptGuidance,
  buildContextSection,
  describeContextQualifier,
  getNonActionableReason,
  isBinaryLikeContent,
} from "../analysis.utils";

// Lives outside `analysis.utils` on purpose: it needs the AI tool profile, which reaches the tRPC server
export async function runQuickFileAudit(
  userId: string,
  input: FileActionInput,
): Promise<QuickFileAuditResult> {
  const rawContent = input.content.trim();

  if (rawContent.length === 0) {
    return buildAuditFallback(
      input.path,
      `The file is empty, so there is not enough evidence for a meaningful audit. ${describeContextQualifier(input.nodeContext)}`,
    );
  }

  if (isBinaryLikeContent(input.content)) {
    return buildAuditFallback(
      input.path,
      `The file looks binary or non-textual, so a code-focused audit would be unreliable. ${describeContextQualifier(input.nodeContext)}`,
    );
  }

  const nonActionableReason = getNonActionableReason(input.path, input.content, input.nodeContext);
  if (nonActionableReason != null) {
    return buildAuditFallback(input.path, nonActionableReason);
  }

  const cleanedCode = await CodeOptimizer.cleanForTool(input.content);
  const contextSection = buildContextSection(input);
  const contextGuidance = buildContextPromptGuidance(input.nodeContext);

  const systemPrompt = [
    buildSingleFileAnalysisPrompt(input.language),
    "\n[CONTEXT HANDLING GUIDANCE]",
    contextGuidance,
  ].join("\n");

  const userPrompt = [
    `<target_file path="${input.path}">`,
    cleanedCode,
    "</target_file>",
    contextSection,
  ]
    .filter(Boolean)
    .join("\n");

  const activeModels = await getActiveModels();

  const result = await callWithFallback<z.infer<typeof QuickFileAuditSchema>>({
    attemptMetadata: { filePath: input.path, operation: "quick-file-audit" },
    models: activeModels.POWERFUL,
    outputSchema: QuickFileAuditSchema,
    prompt: userPrompt,
    system: systemPrompt,
    taskType: "classification",
    tools: buildRepositoryToolProfile("file_action", userId, input.repoId, input.branch),
  });

  return {
    ...result,
    path: input.path,
  };
}
