import { compact, meanBy, sumBy, uniqBy } from "es-toolkit";
import { normalize } from "pathe";
import pm from "picomatch";

import { PROJECT_POLICY_RULES } from "@/server/shared/engine/core/project-policy-rules";
import { AI_POLICY_CONSTANTS } from "@/server/shared/engine/core/scoring-constants";
import { logger } from "@/server/shared/infrastructure/logger";
import { prAnalysisLogger } from "@/server/shared/lib/pr-analysis-logger";

import type { DifferentialAnalysisResult, PRAnalysisConfig, PRFinding } from "../model/pr-types";

type PRDiffInfo = {
  baseSha: string;
  changedFiles: Array<{
    additions: number;
    changes_start?: number;
    deletions: number;
    filename: string;
    patch?: string;
  }>;
  headSha: string;
  owner: string;
  prNumber: number;
  repoName: string;
};

/**
 * Analyzes PR diff using reduced token budget (30-50K vs 210K for full analysis)
 * Runs Sentinel phase for security findings, Mapper for dependency impact
 */
export class DifferentialAnalyzer {
  private config: PRAnalysisConfig;
  private readonly isExcluded: (path: string) => boolean;

  private mapScoreToSeverity(score: number): PRFinding["severity"] {
    const thresholds = AI_POLICY_CONSTANTS.PR_ANALYSIS.SEVERITY_THRESHOLDS;

    if (score >= thresholds.CRITICAL) return "CRITICAL";
    if (score >= thresholds.HIGH) return "HIGH";
    if (score >= thresholds.MEDIUM) return "MEDIUM";
    return "LOW";
  }

  constructor(config: PRAnalysisConfig) {
    this.config = config;
    this.isExcluded = pm(config.excludePatterns);
  }

  /**
   * Main entry point for PR differential analysis
   */
  async analyzePRDiff(diffInfo: PRDiffInfo): Promise<DifferentialAnalysisResult> {
    const startTime = Date.now();
    logger.info({
      changedFiles: diffInfo.changedFiles.length,
      focusAreas: this.config.focusAreas,
      msg: "pr_differential_analysis_started",
      owner: diffInfo.owner,
      prNumber: diffInfo.prNumber,
      repoName: diffInfo.repoName,
      tokenBudget: this.config.tokenBudget,
    });

    try {
      // Step 1: Filter changed files
      const relevantFiles = diffInfo.changedFiles.filter((f) => {
        const normalizedPath = normalize(f.filename);
        if (Boolean(this.isExcluded(normalizedPath))) return false;
        return f.additions + f.deletions <= 1000;
      });
      logger.debug({
        excluded: diffInfo.changedFiles.length - relevantFiles.length,
        msg: "pr_files_filtered",
        relevant: relevantFiles.length,
        total: diffInfo.changedFiles.length,
      });

      if (relevantFiles.length === 0) {
        logger.info({ msg: "pr_no_relevant_files", prNumber: diffInfo.prNumber });
        return {
          analyzedLines: 0,
          changedFiles: 0,
          findings: [],
          riskScore: 0,
          totalDuration: Date.now() - startTime,
        };
      }

      // Step 2: Run Sentinel phase on changed code (security, obvious bugs)
      const sentinelFindings = this.runSentinelPhase(relevantFiles, diffInfo.prNumber);

      // Step 3: Mapper
      const mapperFindings = this.runMapperPhase(relevantFiles, diffInfo.prNumber);

      // Step 5: Combine and score findings
      const allFindings = uniqBy(
        [...sentinelFindings, ...mapperFindings],
        (f) => `${f.file}:${f.line}:${f.type}`
      );
      const scoredFindings = this.applyFocusFilters(allFindings);
      const riskScore = this.calculateRiskScore(scoredFindings);

      const duration = Date.now() - startTime;
      logger.info({
        duration,
        findings: scoredFindings.length,
        msg: "pr_differential_analysis_completed",
        prNumber: diffInfo.prNumber,
        riskScore,
      });

      return {
        analyzedLines: sumBy(relevantFiles, (f) => f.additions + f.deletions),
        changedFiles: relevantFiles.length,
        findings: scoredFindings,
        riskScore,
        totalDuration: duration,
      };
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        msg: "pr_differential_analysis_failed",
        prNumber: diffInfo.prNumber,
      });
      throw error;
    }
  }

  private extractCodeContext(files: PRDiffInfo["changedFiles"], tokenBudget: number): string {
    const maxCharsPerFile = Math.floor(tokenBudget * 3.5); // rough estimate: 1 token ≈ 0.28 chars
    let context = "";

    for (const file of files) {
      if (file.patch == null) continue;

      const fileContext = `\n### File: ${file.filename}\n\`\`\`\n${file.patch}\n\`\`\`\n`;
      if ((context + fileContext).length > maxCharsPerFile) {
        break;
      }
      context += fileContext;
    }

    return context;
  }

  private runSentinelPhase(files: PRDiffInfo["changedFiles"], prNumber: number): PRFinding[] {
    const findings: PRFinding[] = [];
    const hunkRe = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

    for (const file of files) {
      if (file.patch == null) continue;
      const { patterns, todoPatterns } = PROJECT_POLICY_RULES.security;

      const lines = file.patch.split("\n");
      let newLineNum = 0;

      for (const raw of lines) {
        const m = hunkRe.exec(raw);
        if (m != null) {
          newLineNum = Number(m[1]);
          continue;
        }

        if (raw.startsWith("+++ ") || raw.startsWith("--- ")) continue;
        if (raw.startsWith("-")) {
          continue;
        }

        const line = raw.startsWith("+") ? raw.slice(1) : raw;

        if (patterns.test(line)) {
          findings.push({
            codeSnippet: line.trim(),
            file: file.filename,
            line: newLineNum,
            message: "Code pattern may introduce security vulnerability",
            score: 8,
            severity: this.mapScoreToSeverity(8),
            suggestion: "Review and validate input handling",
            title: "Potential security issue detected",
            type: "security",
          });
        }

        if (todoPatterns.test(line)) {
          findings.push({
            codeSnippet: line.trim(),
            file: file.filename,
            line: newLineNum,
            message: "Incomplete implementation marker",
            score: 2,
            severity: this.mapScoreToSeverity(2),
            suggestion: "Complete or remove TODO",
            title: "TODO/FIXME comment found",
            type: "style",
          });
        }

        if (!raw.startsWith("-")) {
          newLineNum++;
        }
      }
    }

    prAnalysisLogger.sentinelPhaseCompleted(prNumber, prNumber, findings.length, 0);
    return findings;
  }

  private runMapperPhase(files: PRDiffInfo["changedFiles"], prNumber: number): PRFinding[] {
    const findings: PRFinding[] = compact(
      files.map((file) => {
        if (file.patch == null) return null;

        const addedLines = file.patch.split("\n").filter((l) => l.startsWith("+")).length;
        const complexityRatio = addedLines / Math.max(file.additions, 1);

        if (complexityRatio > 2 || addedLines > 300) {
          return {
            file: file.filename,
            line: 1,
            message: `Файл содержит ${addedLines} новых строк. Высокая плотность изменений затрудняет ревью.`,
            score: 5,
            severity: this.mapScoreToSeverity(5),
            suggestion: "Разбейте изменения на несколько логических модулей или PR.",
            title: "Высокая сложность изменений",
            type: "performance",
          } satisfies PRFinding;
        }
        return null;
      })
    );

    prAnalysisLogger.mapperPhaseCompleted(prNumber, prNumber, findings.length, 0);
    return findings;
  }

  private applyFocusFilters(findings: PRFinding[]): PRFinding[] {
    if (this.config.focusAreas.length === 0) return findings;

    return findings.filter((f) => (this.config.focusAreas as string[]).includes(f.type));
  }

  private calculateRiskScore(findings: PRFinding[]): number {
    if (findings.length === 0) return 0;

    const avgSeverity = meanBy(findings, (f) => f.score);
    return Math.min(10, Math.ceil(avgSeverity));
  }
}
