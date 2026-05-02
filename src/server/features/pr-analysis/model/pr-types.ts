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
