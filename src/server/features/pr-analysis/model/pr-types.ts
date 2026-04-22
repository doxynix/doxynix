import type { PRCommentStyle, PRFocusArea } from "@prisma/client";

// ============================================================================
// FINDINGS & ANALYSIS
// ============================================================================

export type PRFinding = {
  codeSnippet?: string;
  file: string;
  line: number;
  message: string;
  score: number;
  severity: "CRITICAL" | "HIGH" | "LOW" | "MEDIUM"; // Слова для UI
  suggestion?: string;
  title: string;
  type: "architecture" | "bug" | "complexity" | "performance" | "security" | "style";
};

export type DifferentialAnalysisResult = {
  analyzedLines: number;
  changedFiles: number;
  findings: PRFinding[];
  riskScore: number; // 0-10
  totalDuration: number; // ms
};

export type PRAnalysisConfig = {
  ciSkip: boolean;
  commentStyle: PRCommentStyle;
  enabled: boolean;
  excludePatterns: string[];
  focusAreas: PRFocusArea[];
  tokenBudget: number;
};

export type PRCommentBody = {
  body: string;
  suggestions: string[];
  title: string;
};

// ============================================================================
// FIX GENERATION (STATELESS)
// ============================================================================
/**
 * PRIVACY: Diff is NEVER stored in DB. Generated on-demand, sent to frontend,
 * and sent back to applyFix. This prevents code storage violations.
 */

export type FindingForFix = {
  file: string;
  line: number;
  suggestion?: string;
  type: string;
};

/**
 * Diff content (unified format). NOT stored in DB.
 */
export type GeneratedDiff = {
  additions: number;
  deletions: number;
  filePath: string;
  patch: string; // Unified diff format
};

/**
 * Frontend sends this back to applyFix. No DB storage of diffs.
 */
export type FixApplicationPayload = {
  branch: string;
  diffs: GeneratedDiff[]; // In-memory, not DB-persisted
  estimatedImpact: number;
  fixId: number;
  repoId: number;
  title: string;
};

/**
 * Return value from fix generation. Frontend uses this to show preview.
 */
export type FixGenerationResult = {
  branch: string;
  diffs: GeneratedDiff[]; // In-memory diffs for UI preview
  estimatedImpact: number;
  fixId: number; // DRAFT fix record ID (minimal metadata only)
  title: string;
};
