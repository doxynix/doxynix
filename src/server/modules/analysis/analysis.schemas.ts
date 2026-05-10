import z from "zod";

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

export const DocumentFilePreviewSchema = z.object({
  confidence: FileActionConfidenceSchema.describe(
    'Strictly evaluate the documentation confidence. Choose exactly "high", "medium", or "low".'
  ),
  documentation: z
    .string()
    .min(1)
    .describe(
      "The generated full inline documentation comments (JSDoc/Docstring/etc) inside the target file context."
    ),
  summary: z
    .string()
    .min(1)
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

export type ImpactAnalysisRecord = Awaited<ReturnType<typeof loadImpactAnalysis>>;
export type ImpactAnalysis = NonNullable<ImpactAnalysisRecord>;
export type ParsedFinding = z.infer<typeof persistedFindingSchema>;
