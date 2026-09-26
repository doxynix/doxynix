import type * as z from "zod";

import { callWithFallback } from "@/server/utils/call";
import { CodeOptimizer } from "@/server/utils/optimizers";

import { getActiveModels } from "../ai/ai-constants";
import { buildRepositoryToolProfile } from "../ai/ai-tools";
import { buildCodeDocSystemPrompt } from "../ai/prompts-refactored";
import type { DocumentFilePreviewResult } from "../analysis.schemas";
import { DocumentFilePreviewSchema } from "../analysis.schemas";
import {
  buildContextPromptGuidance,
  buildContextSection,
  buildDocumentFallback,
  describeContextQualifier,
  getNonActionableReason,
  isBinaryLikeContent,
} from "../analysis.utils";
import type { FileActionRequest } from "../services/file-actions.service";
import { applyDocumentSurgicalEdit } from "./document-surgical-edit";

/**
 * Single-file documentation pass.
 *
 * Lives outside the file-actions service on purpose: it needs the AI tool
 * profile, which reaches the tRPC server, and a service that the router calls
 * must not depend on the router.
 */

export async function runDocumentFilePreview(
  userId: number,
  input: FileActionRequest,
): Promise<DocumentFilePreviewResult> {
  const rawContent = input.content.trim();

  if (rawContent.length === 0) {
    return buildDocumentFallback(
      input.path,
      `The file is empty, so there is nothing useful to document yet. ${describeContextQualifier(input.nodeContext)}`,
    );
  }

  if (isBinaryLikeContent(input.content)) {
    return buildDocumentFallback(
      input.path,
      `The file looks binary or non-textual, so documentation preview is not available. ${describeContextQualifier(input.nodeContext)}`,
    );
  }

  const nonActionableReason = getNonActionableReason(input.path, input.content, input.nodeContext);
  if (nonActionableReason != null) {
    return buildDocumentFallback(input.path, nonActionableReason);
  }

  const cleanedCode = await CodeOptimizer.cleanForTool(input.content);
  const contextSection = buildContextSection(input);
  const contextGuidance = buildContextPromptGuidance(input.nodeContext);

  const systemPrompt = [
    buildCodeDocSystemPrompt(input.language),
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

  const result = await callWithFallback<z.infer<typeof DocumentFilePreviewSchema>>({
    attemptMetadata: { filePath: input.path, operation: "document-file-preview" },
    models: activeModels.WRITER,
    outputSchema: DocumentFilePreviewSchema,
    prompt: userPrompt,
    system: systemPrompt,
    taskType: "creative",
    tools: buildRepositoryToolProfile("file_action", userId, input.repoId, input.branch),
  });

  let documentedCode = input.content;

  if (Array.isArray(result.edits)) {
    for (const edit of result.edits) {
      if (edit.search && edit.replace) {
        documentedCode = applyDocumentSurgicalEdit({
          filePath: input.path,
          original: documentedCode,
          replace: edit.replace,
          search: edit.search,
        });
      }
    }
  }

  return {
    confidence: result.confidence,
    documentation: documentedCode,
    edits: result.edits,
    path: input.path,
    summary: result.summary,
  };
}
