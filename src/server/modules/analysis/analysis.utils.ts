import type { DocType, Repo } from "@prisma/client";
import { orderBy, uniqBy } from "es-toolkit";
import { normalize } from "pathe";
import type { z } from "zod";

import { callWithFallback } from "@/server/utils/call";
import { CodeOptimizer } from "@/server/utils/optimizers";
import type { RepoSearchResult } from "@/server/utils/types";

import { getActiveModels } from "./ai/ai-constants";
import { buildSingleFileAnalysisPrompt } from "./ai/prompts-refactored";
import {
  QuickFileAuditSchema,
  type DocumentFilePreviewResult,
  type FileActionInput,
  type FileActionNodeContext,
  type QuickFileAuditResult,
} from "./analysis.schemas";
import { ProjectPolicy } from "./engine/core/project-policy";

export function isBinaryLikeContent(content: string): boolean {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(content);
}

export function isProbablyMinifiedContent(content: string): boolean {
  const sample = content.trim();
  const len = sample.length;
  if (len < 2000) return false;

  const sliceSize = Math.min(len, 8000);
  const sampleSlice = sample.slice(0, sliceSize);

  const lines = sampleSlice.split("\n");
  const newlineCountInSlice = lines.length - 1;

  let longestLineInSlice = 0;
  for (const line of lines) {
    if (line.length > longestLineInSlice) {
      longestLineInSlice = line.length;
    }
  }

  let whitespaceChars = 0;
  for (let i = 0; i < sliceSize; i++) {
    const code = sampleSlice.charCodeAt(i);
    if (code === 32 || code === 9 || code === 10 || code === 13) {
      whitespaceChars++;
    }
  }
  const whitespaceRatio = whitespaceChars / sliceSize;

  return (
    longestLineInSlice > 1800 ||
    (newlineCountInSlice <= 3 && len > 4000) ||
    (longestLineInSlice > 1200 && whitespaceRatio < 0.08)
  );
}

export function getNonActionableReason(
  path: string,
  content: string,
  nodeContext?: FileActionNodeContext
): null | string {
  const normalizedPath = normalize(path);
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

export function getContextStrength(nodeContext?: FileActionNodeContext) {
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

export function describeContextQualifier(nodeContext?: FileActionNodeContext): string {
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

export function buildContextPromptGuidance(nodeContext?: FileActionNodeContext): string {
  const strength = getContextStrength(nodeContext);
  const graphBacked = (nodeContext?.graphNeighbors?.length ?? 0) > 0;

  const strictEnumGuard =
    'CRITICAL: The JSON property "confidence" MUST be set exactly to a literal string value: "high", "medium", or "low". Do not invent other strings.';

  if (strength === "none") {
    return [
      "No repository node context is available.",
      "Stay file-local and avoid broad architectural claims.",
      'Set the JSON "confidence" field strictly to "low" or "medium".',
      strictEnumGuard,
    ].join(" ");
  }

  if (graphBacked && strength === "strong") {
    return [
      "Strong graph-backed repository context is available.",
      "You may use nearby structural neighbors and selected-node relationships when explaining impact or responsibilities.",
      "Still avoid claims that are not supported by the provided file and context block.",
      strictEnumGuard,
    ].join(" ");
  }

  if (graphBacked && strength === "moderate") {
    return [
      "Moderate graph-backed repository context is available.",
      "Use structural-neighbor hints carefully, but keep conclusions anchored to the current file.",
      'Set the JSON "confidence" field strictly to "medium".',
      strictEnumGuard,
    ].join(" ");
  }

  if (graphBacked) {
    return [
      "Only light graph-backed context is available.",
      "Treat repository-level relationships as hints rather than strong facts.",
      'Set the JSON "confidence" field strictly to "low" or "medium".',
      strictEnumGuard,
    ].join(" ");
  }

  if (strength === "strong" || strength === "moderate") {
    return [
      "Node-level repository context is available, but it is not graph-backed.",
      "You may use it to frame likely role and surrounding concerns, but avoid overstating dependency relationships.",
      'Set the JSON "confidence" field strictly to "medium".',
      strictEnumGuard,
    ].join(" ");
  }

  return [
    "Only light node-level repository context is available.",
    "Keep the result conservative and mostly file-local.",
    'Set the JSON "confidence" field strictly to "low".',
    strictEnumGuard,
  ].join(" ");
}

export function buildAuditFallback(path: string, summary: string): QuickFileAuditResult {
  return {
    confidence: "low",
    issues: [],
    path,
    strengths: [],
    suggestions: [],
    summary,
  };
}

export function buildDocumentFallback(path: string, summary: string): DocumentFilePreviewResult {
  return {
    confidence: "low",
    documentation: summary,
    path,
    summary,
  };
}

export function formatQuickFileAuditMarkdown(result: QuickFileAuditResult): string {
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

export function buildContextSection(input: FileActionInput): string {
  const parts: string[] = [];

  if (input.nodeContext != null) {
    const ctx = input.nodeContext;
    parts.push(`Node title: ${ctx.title}`);
    parts.push(`Node role: ${ctx.role}`);
    parts.push(`Node confidence: ${ctx.confidence}`);
    parts.push(`Why important: ${ctx.whyImportant}`);

    if (ctx.reviewPriority != null) {
      parts.push(`Review priority: ${ctx.reviewPriority.level} - ${ctx.reviewPriority.reason}`);
    }
    if ((ctx.recommendedActions ?? []).length > 0) {
      parts.push(`Recommended actions: ${ctx.recommendedActions?.join("; ")}`);
    }
    if ((ctx.nextSuggestedPaths ?? []).length > 0) {
      parts.push(`Next suggested paths: ${ctx.nextSuggestedPaths?.join(", ")}`);
    }
    if ((ctx.neighborPaths ?? []).length > 0) {
      parts.push(`Neighbor paths: ${ctx.neighborPaths?.join(", ")}`);
    }
    if ((ctx.graphNeighbors ?? []).length > 0) {
      parts.push(`Graph neighbors: ${ctx.graphNeighbors?.join(", ")}`);
    }
    if ((ctx.sourcePaths ?? []).length > 0) {
      parts.push(`Source paths: ${ctx.sourcePaths?.join(", ")}`);
    }
    if (ctx.neighborBuckets != null) {
      for (const [bucket, paths] of Object.entries(ctx.neighborBuckets)) {
        if (paths.length === 0) continue;
        parts.push(`${bucket}: ${paths.join(", ")}`);
      }
    }
    if ((ctx.summary ?? []).length > 0) {
      parts.push(`Node summary: ${ctx.summary?.join(" ")}`);
    }
  }

  if (input.contextBlock != null && input.contextBlock.trim().length > 0) {
    parts.push(`\n[Context Block]\n${input.contextBlock}`);
  }

  return parts.length === 0
    ? ""
    : `<repository_context>\n${parts.join("\n")}\n</repository_context>`;
}

export function deriveMaintenanceStatus(repo: Repo) {
  const pushedAt = repo.pushedAt ?? repo.updatedAt;
  const ageInMonths = (Date.now() - new Date(pushedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (ageInMonths > 12) return "dead" as const;
  if (ageInMonths > 6) return "stale" as const;
  return "active" as const;
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
  });

  return {
    ...result,
    path: input.path,
  };
}

export function scoreSearchMatch(terms: string[], values: Array<null | string | undefined>) {
  const haystack = values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((value) => value.toLowerCase());

  if (haystack.length === 0) return 0;

  let score = 0;
  for (const term of terms) {
    const exact = haystack.includes(term);
    const prefix = haystack.some((value) => value.startsWith(term));
    const partial = haystack.some((value) => value.includes(term));

    if (exact) score += 12;
    else if (prefix) score += 8;
    else if (partial) score += 4;
    else return 0;
  }

  return score;
}

export function dedupeSearchResults(results: RepoSearchResult[]) {
  const sortedByBest = orderBy(results, [(r) => r.score], ["desc"]);
  const unique = uniqBy(sortedByBest, (r) => r.id);
  return orderBy(unique, [(r) => r.score, (r) => r.label], ["desc", "asc"]);
}

export function pickLatestDocsByType<TDoc extends { type: DocType; updatedAt: Date }>(
  docs: TDoc[]
) {
  const latest = uniqBy(orderBy(docs, [(d) => d.updatedAt], ["desc"]), (d) => d.type);
  return orderBy(latest, [(d) => d.type], ["asc"]);
}
