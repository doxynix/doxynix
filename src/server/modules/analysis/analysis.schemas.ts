import { z } from "zod";

import type { analysisRepo } from "./analysis.repository";

const FileActionConfidenceSchema = z.enum(["high", "medium", "low"]);

export const QuickFileAuditSchema = z.object({
  confidence: FileActionConfidenceSchema.describe(
    'Strictly evaluate the analysis confidence. Choose exactly "high", "medium", or "low".'
  ),
  issues: z
    .array(
      z
        .string()
        .describe(
          "Technical risk, bug, or anti-pattern. Keep identifiers and variable tokens in pure English."
        )
    )
    .max(5),
  strengths: z
    .array(
      z.string().describe("Positive architectural pattern or good practice found in the code.")
    )
    .max(5),
  suggestions: z
    .array(z.string().describe("Actionable refactoring step or improvement recommendation."))
    .max(5),
  summary: z
    .string()
    .min(1)
    .describe(
      "A high-density technical summary paragraph detailing the final conclusion of the audit."
    ),
});

export const CodeDocEditSchema = z.object({
  replace: z
    .string()
    .trim()
    .min(1)
    .describe(
      "CRITICAL: The exact same block of code from 'search', but with newly injected inline KDoc/JSDoc/docstring comments added. " +
        "The original code logic, variable names, functions, imports, and active code statements inside this block " +
        "MUST remain 100% identical, character-for-character, to the original code in 'search'. " +
        "Under NO circumstances are you allowed to refactor, simplify, optimize, or rewrite the code implementation!"
    ),
  search: z
    .string()
    .trim()
    .min(1)
    .describe(
      "The exact contiguous block of code from the original file to search for (usually the class, method, or function signature)."
    ),
});

export const DocumentFilePreviewSchema = z.object({
  confidence: z.enum(["high", "medium", "low"]),
  edits: z
    .array(CodeDocEditSchema)
    .describe("List of targeted search-and-replace edits to inject documentation"),
  summary: z
    .string()
    .describe("A 1-2 sentence description summarizing the core modules documented."),
});

export type FileActionNodeContext = {
  confidence: "high" | "low" | "medium";
  graphNeighbors?: string[];
  neighborBuckets?: null | Record<string, string[]>;
  neighborPaths?: string[];
  nextSuggestedPaths?: string[];
  recommendedActions?: string[];
  reviewPriority?: null | {
    level: "high" | "low" | "medium";
    reason: string;
  };
  role: string;
  sourcePaths?: string[];
  summary?: string[];
  title: string;
  whyImportant: string;
};

export type FileActionInput = {
  branch: string;
  content: string;
  contextBlock?: string;
  language: string;
  nodeContext?: FileActionNodeContext;
  path: string;
  repoId: string;
};

export type QuickFileAuditResult = z.infer<typeof QuickFileAuditSchema> & {
  path: string;
};

export type DocumentFilePreviewResult = z.infer<typeof DocumentFilePreviewSchema> & {
  documentation: string;
  path: string;
};

export const changedFileSnapshotSchema = z.object({
  additions: z.number().int().min(0),
  deletions: z.number().int().min(0),
  filePath: z.string().min(1),
  previousFilePath: z.string().min(1).nullable().optional(),
  status: z.enum(["added", "modified", "removed", "renamed"]),
});

export const persistedFindingSchema = z.object({
  file: z.string().min(1),
  line: z.number().int().min(1),
  message: z.string().min(1),
  score: z.number().int().min(0).optional(),
  title: z.string().min(1),
  type: z.string().min(1),
});

export type ImpactAnalysisRecord = Awaited<ReturnType<typeof analysisRepo.loadImpactAnalysis>>;
export type ImpactAnalysis = NonNullable<ImpactAnalysisRecord>;
export type ParsedFinding = z.infer<typeof persistedFindingSchema>;

export const FindingForFixSchema = z.object({
  file: z.string(),
  line: z.number(),
  suggestion: z.string().optional(),
  type: z.string(),
});

export const StagedFixedFileSchema = z.object({
  filePath: z.string(),
  newContent: z.string(),
});

export const FixApplicationPayloadSchema = z.object({
  branch: z.string().min(1),
  fixedFiles: z.array(StagedFixedFileSchema).min(1),
  fixId: z.uuid(),
  repoId: z.uuid(),
  title: z.string().min(1),
});

export const GeneratedFixDTO = z.object({
  branch: z.string(),
  createdAt: z.date(),
  description: z.string().nullable(),
  estimatedImpact: z.number().nullable(),
  githubPrNumber: z.number().nullable(),
  githubPrUrl: z.string().nullable(),
  id: z.uuid(),
  status: z.string(),
  title: z.string(),
});

export const GeneratedFixDetailedDTO = GeneratedFixDTO.extend({
  resultJson: z.any().nullable(),
});

export const FixResultSchema = z.object({
  fixedFiles: z.array(StagedFixedFileSchema),
});

export const PrAiReviewFindingSchema = z.object({
  codeSnippet: z
    .string()
    .optional()
    .describe("Exact lines of code causing the issue from the diff"),
  file: z.string().describe("The file path containing the issue"),
  line: z.number().int().min(1).describe("The line number of the issue"),
  message: z.string().describe("Detailed technical explanation of the issue and its impact"),
  score: z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe("Severity score from 1 (lowest) to 10 (critical)"),
  suggestion: z
    .string()
    .optional()
    .describe(
      "CRITICAL: Must contain ONLY the direct, compilable, raw replacement code to fix the issue. Absolute NO conversational text, NO explanations, and NO markdown code block fences (do NOT use backticks). This code must be ready to replace the code at the given 'line' directly. If a direct code-level fix is not applicable, omit this field."
    ),
  title: z.string().describe("Short descriptive title of the finding"),
  type: z
    .enum(["ARCHITECTURE", "BUG", "COMPLEXITY", "PERFORMANCE", "SECURITY", "STYLE"])
    .describe("The category of the finding"),
});

export const PrAiReviewOutputSchema = z.object({
  findings: z
    .array(PrAiReviewFindingSchema)
    .describe("List of code review findings discovered in the PR changes"),
  summary: z
    .string()
    .describe(
      "A high-density, professional technical Markdown description/body for the GitHub Pull Request (including overview, impact, and logical changes)"
    ),
});
