import { z } from "zod";

import { normalizeRepoPath } from "@/server/shared/engine/core/common";
import { ProjectPolicy } from "@/server/shared/engine/core/project-policy";
import { callWithFallback } from "@/server/shared/lib/call";
import { cleanCodeForAi } from "@/server/shared/lib/optimizers";

import { AI_MODELS } from "../../analyze-repo/lib/constants";
import {
  CODE_DOC_SYSTEM_PROMPT,
  CODE_DOC_USER_PROMPT,
  SINGLE_FILE_ANALYSIS_PROMPT,
} from "../../analyze-repo/lib/prompts-refactored";

const FileActionConfidenceSchema = z.enum(["high", "medium", "low"]);

const QuickFileAuditSchema = z.object({
  confidence: FileActionConfidenceSchema,
  issues: z.array(z.string()).max(5),
  strengths: z.array(z.string()).max(5),
  suggestions: z.array(z.string()).max(5),
  summary: z.string().min(1),
});

const DocumentFilePreviewSchema = z.object({
  confidence: FileActionConfidenceSchema,
  documentation: z.string().min(1),
  summary: z.string().min(1),
});

export type FileActionNodeContext = {
  confidence: "high" | "low" | "medium";
  graphNeighbors?: string[];
  neighborBuckets?: Record<string, string[]> | null;
  neighborPaths?: string[];
  nextSuggestedPaths?: string[];
  recommendedActions?: string[];
  reviewPriority?: {
    level: "high" | "low" | "medium";
    reason: string;
  } | null;
  role: string;
  sourcePaths?: string[];
  summary?: string[];
  title: string;
  whyImportant: string;
};

type FileActionInput = {
  content: string;
  contextBlock?: string;
  language: string;
  nodeContext?: FileActionNodeContext;
  path: string;
};

export type QuickFileAuditResult = z.infer<typeof QuickFileAuditSchema> & {
  path: string;
};

export type DocumentFilePreviewResult = z.infer<typeof DocumentFilePreviewSchema> & {
  path: string;
};

function isBinaryLikeContent(content: string) {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(content);
}

function getContextStrength(nodeContext?: FileActionNodeContext) {
  if (nodeContext == null) return "none" as const;

  const signalCount =
    (nodeContext.graphNeighbors?.length ?? 0) +
    (nodeContext.sourcePaths?.length ?? 0) +
    (nodeContext.neighborPaths?.length ?? 0) +
    (nodeContext.nextSuggestedPaths?.length ?? 0) +
    (nodeContext.recommendedActions?.length ?? 0) +
    Object.values(nodeContext.neighborBuckets ?? {}).filter((paths) => paths.length > 0).length;

  if (signalCount >= 12) return "strong" as const;
  if (signalCount >= 7) return "moderate" as const;
  return "light" as const;
}

function describeContextQualifier(nodeContext?: FileActionNodeContext) {
  const strength = getContextStrength(nodeContext);
  if (strength === "none") {
    return "No selected-node repository context was available.";
  }

  if ((nodeContext?.graphNeighbors?.length ?? 0) > 0) {
    if (strength === "strong") {
      return "Strong graph-backed repository context was available.";
    }
    if (strength === "moderate") {
      return "Graph-backed repository context was available, but only partially rich.";
    }
    return "Only light graph-backed repository context was available.";
  }

  if (strength === "strong" || strength === "moderate") {
    return "Node-level repository context was available, but it was not graph-backed.";
  }

  return "Only light node-level repository context was available.";
}

function buildContextPromptGuidance(nodeContext?: FileActionNodeContext) {
  const strength = getContextStrength(nodeContext);
  const graphBacked = (nodeContext?.graphNeighbors?.length ?? 0) > 0;

  if (strength === "none") {
    return [
      "No repository node context is available.",
      "Stay file-local and avoid broad architectural claims.",
      'Prefer "low" or "medium" confidence unless the code itself is unambiguous.',
    ].join(" ");
  }

  if (graphBacked && strength === "strong") {
    return [
      "Strong graph-backed repository context is available.",
      "You may use nearby structural neighbors and selected-node relationships when explaining impact or responsibilities.",
      "Still avoid claims that are not supported by the provided file and context block.",
    ].join(" ");
  }

  if (graphBacked && strength === "moderate") {
    return [
      "Moderate graph-backed repository context is available.",
      "Use structural-neighbor hints carefully, but keep conclusions anchored to the current file.",
      'Use "medium" confidence unless the evidence is unusually clear.',
    ].join(" ");
  }

  if (graphBacked) {
    return [
      "Only light graph-backed context is available.",
      "Treat repository-level relationships as hints rather than strong facts.",
      'Prefer cautious wording and "low" or "medium" confidence.',
    ].join(" ");
  }

  if (strength === "strong" || strength === "moderate") {
    return [
      "Node-level repository context is available, but it is not graph-backed.",
      "You may use it to frame likely role and surrounding concerns, but avoid overstating dependency relationships.",
      'Prefer "medium" confidence unless the file itself makes the conclusion clear.',
    ].join(" ");
  }

  return [
    "Only light node-level repository context is available.",
    "Keep the result conservative and mostly file-local.",
    'Prefer "low" confidence unless the code is very clear on its own.',
  ].join(" ");
}

function isProbablyMinifiedContent(content: string) {
  const sample = content.trim();
  if (sample.length < 2000) return false;

  const lines = sample.split(/\r?\n/u);
  const longestLine = Math.max(...lines.map((line) => line.length), 0);
  const newlineCount = Math.max(lines.length - 1, 0);
  const whitespaceRatio = (sample.match(/\s/g) ?? []).length / sample.length;

  return (
    longestLine > 1800 ||
    (newlineCount <= 3 && sample.length > 4000) ||
    (longestLine > 1200 && whitespaceRatio < 0.08)
  );
}

function getNonActionableReason(
  path: string,
  content: string,
  nodeContext?: FileActionNodeContext
) {
  const normalizedPath = normalizeRepoPath(path);
  if (ProjectPolicy.isSensitive(normalizedPath)) {
    return `The file looks sensitive, so the server intentionally skips AI inspection for it. ${describeContextQualifier(nodeContext)}`;
  }
  if (ProjectPolicy.isIgnored(normalizedPath) || ProjectPolicy.isAssetFile(normalizedPath)) {
    return `The file looks like an asset, vendored dependency, or build artifact, so an AI code action would be mostly noise. ${describeContextQualifier(nodeContext)}`;
  }
  if (ProjectPolicy.isGeneratedFile(normalizedPath)) {
    return `The file looks generated, so auditing or documenting it directly would add more noise than value. ${describeContextQualifier(nodeContext)}`;
  }
  if (ProjectPolicy.isLowSignalConfig(normalizedPath)) {
    return `The file looks like low-signal lock or build metadata, so a code-focused action would not be very useful. ${describeContextQualifier(nodeContext)}`;
  }
  if (isProbablyMinifiedContent(content)) {
    return `The file looks minified or machine-packed, so a reliable file-level action is not available. ${describeContextQualifier(nodeContext)}`;
  }
  return null;
}

function buildAuditFallback(path: string, summary: string): QuickFileAuditResult {
  return {
    confidence: "low",
    issues: [],
    path,
    strengths: [],
    suggestions: [],
    summary,
  };
}

function buildDocumentFallback(path: string, summary: string): DocumentFilePreviewResult {
  return {
    confidence: "low",
    documentation: summary,
    path,
    summary,
  };
}

export function formatQuickFileAuditMarkdown(result: QuickFileAuditResult) {
  const sections = [
    "# Quick File Audit",
    `**Path:** \`${result.path}\``,
    `**Confidence:** ${result.confidence}`,
    "",
    result.summary,
  ];

  if (result.strengths.length > 0) {
    sections.push("", "## Strengths", ...result.strengths.map((item) => `- ${item}`));
  }

  if (result.issues.length > 0) {
    sections.push("", "## Issues", ...result.issues.map((item) => `- ${item}`));
  }

  if (result.suggestions.length > 0) {
    sections.push("", "## Suggestions", ...result.suggestions.map((item) => `- ${item}`));
  }

  return sections.join("\n");
}

function buildContextSection(input: FileActionInput) {
  const parts: string[] = [];

  if (input.nodeContext != null) {
    parts.push(`Node title: ${input.nodeContext.title}`);
    parts.push(`Node role: ${input.nodeContext.role}`);
    parts.push(`Node confidence: ${input.nodeContext.confidence}`);
    parts.push(`Why important: ${input.nodeContext.whyImportant}`);

    if (input.nodeContext.reviewPriority != null) {
      parts.push(
        `Review priority: ${input.nodeContext.reviewPriority.level} - ${input.nodeContext.reviewPriority.reason}`
      );
    }

    if ((input.nodeContext.recommendedActions ?? []).length > 0) {
      parts.push(`Recommended actions: ${input.nodeContext.recommendedActions?.join("; ")}`);
    }

    if ((input.nodeContext.nextSuggestedPaths ?? []).length > 0) {
      parts.push(`Next suggested paths: ${input.nodeContext.nextSuggestedPaths?.join(", ")}`);
    }

    if ((input.nodeContext.neighborPaths ?? []).length > 0) {
      parts.push(`Neighbor paths: ${input.nodeContext.neighborPaths?.join(", ")}`);
    }

    if ((input.nodeContext.graphNeighbors ?? []).length > 0) {
      parts.push(`Graph neighbors: ${input.nodeContext.graphNeighbors?.join(", ")}`);
    }

    if ((input.nodeContext.sourcePaths ?? []).length > 0) {
      parts.push(`Source paths: ${input.nodeContext.sourcePaths?.join(", ")}`);
    }

    if (input.nodeContext.neighborBuckets != null) {
      for (const [bucket, paths] of Object.entries(input.nodeContext.neighborBuckets)) {
        if (paths.length === 0) continue;
        parts.push(`${bucket}: ${paths.join(", ")}`);
      }
    }

    if ((input.nodeContext.summary ?? []).length > 0) {
      parts.push(`Node summary: ${input.nodeContext.summary?.join(" ")}`);
    }
  }

  if (input.contextBlock != null && input.contextBlock.trim().length > 0) {
    parts.push(input.contextBlock);
  }

  return parts.length === 0 ? "" : `\n\nRepository context:\n${parts.join("\n")}`;
}

export async function runQuickFileAudit(input: FileActionInput): Promise<QuickFileAuditResult> {
  const rawContent = input.content.trim();

  if (rawContent.length === 0) {
    return buildAuditFallback(
      input.path,
      `The file is empty, so there is not enough evidence for a meaningful audit. ${describeContextQualifier(input.nodeContext)}`
    );
  }

  if (isBinaryLikeContent(input.content)) {
    return buildAuditFallback(
      input.path,
      `The file looks binary or non-textual, so a code-focused audit would be unreliable. ${describeContextQualifier(input.nodeContext)}`
    );
  }

  const nonActionableReason = getNonActionableReason(input.path, input.content, input.nodeContext);
  if (nonActionableReason != null) {
    return buildAuditFallback(input.path, nonActionableReason);
  }

  const cleanedCode = cleanCodeForAi(input.content, input.path);
  const contextSection = buildContextSection(input);
  const contextGuidance = buildContextPromptGuidance(input.nodeContext);

  const result = await callWithFallback<z.infer<typeof QuickFileAuditSchema>>({
    attemptMetadata: { filePath: input.path, operation: "quick-file-audit" },
    models: AI_MODELS.POWERFUL,
    outputSchema: QuickFileAuditSchema,
    prompt: `File: ${input.path}${contextSection}\n\nCode:\n${cleanedCode}`,
    system: `${SINGLE_FILE_ANALYSIS_PROMPT(input.language)}

Context handling guidance:
${contextGuidance}

Return a JSON object with:
- summary: one short paragraph with the main conclusion
- strengths: up to 3 concise positive findings
- issues: up to 5 concrete risks or weaknesses
- suggestions: up to 5 actionable next steps
- confidence: "high" | "medium" | "low"

Use "low" confidence when the file is too small, too generic, or lacks enough context.`,
    temperature: 0.2,
    useSearchGrounding: false,
  });

  return {
    ...result,
    path: input.path,
  };
}

export async function runDocumentFilePreview(
  input: FileActionInput
): Promise<DocumentFilePreviewResult> {
  const rawContent = input.content.trim();

  if (rawContent.length === 0) {
    return buildDocumentFallback(
      input.path,
      `The file is empty, so there is nothing useful to document yet. ${describeContextQualifier(input.nodeContext)}`
    );
  }

  if (isBinaryLikeContent(input.content)) {
    return buildDocumentFallback(
      input.path,
      `The file looks binary or non-textual, so documentation preview is not available. ${describeContextQualifier(input.nodeContext)}`
    );
  }

  const nonActionableReason = getNonActionableReason(input.path, input.content, input.nodeContext);
  if (nonActionableReason != null) {
    return buildDocumentFallback(input.path, nonActionableReason);
  }

  const cleanedCode = cleanCodeForAi(input.content, input.path);
  const contextSection = buildContextSection(input);
  const contextGuidance = buildContextPromptGuidance(input.nodeContext);

  const result = await callWithFallback<z.infer<typeof DocumentFilePreviewSchema>>({
    attemptMetadata: { filePath: input.path, operation: "document-file-preview" },
    models: AI_MODELS.WRITER,
    outputSchema: DocumentFilePreviewSchema,
    prompt: `${CODE_DOC_USER_PROMPT(input.path, cleanedCode)}${contextSection}`,
    system: `${CODE_DOC_SYSTEM_PROMPT(input.language)}

Context handling guidance:
${contextGuidance}

Return a JSON object with:
- documentation: the full file content with added documentation comments
- summary: 1-2 sentences describing what was documented
- confidence: "high" | "medium" | "low"

Use "low" confidence when the file is too small, too generic, or non-idiomatic for reliable inline documentation.`,
    temperature: 0.1,
    useSearchGrounding: false,
  });

  return {
    ...result,
    path: input.path,
  };
}
