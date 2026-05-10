import { compact, meanBy, sumBy, uniqBy } from "es-toolkit";
import parseGitDiff from "parse-git-diff";
import { normalize } from "pathe";
import pm from "picomatch";

import { appLogger } from "@/server/core/app-logger";
import { prAnalysisLogger } from "@/server/utils/pr-analysis-logger";

import { PROJECT_POLICY_RULES } from "../engine/core/project-policy-rules";
import { AI_POLICY_CONSTANTS } from "../engine/core/scoring-constants";
import type { DifferentialAnalysisResult, PRAnalysisConfig, PRFinding } from "./pr-types";

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

  constructor(config: PRAnalysisConfig) {
    this.config = config;
    this.isExcluded = pm(config.excludePatterns);
  }

  /**
   * Main entry point for PR differential analysis
   */
  async analyzePRDiff(diffInfo: PRDiffInfo): Promise<DifferentialAnalysisResult> {
    const startTime = Date.now();
    appLogger.info({
      changedFiles: diffInfo.changedFiles.length,
      focusAreas: this.config.focusAreas,
      msg: "pr_differential_analysis_started",
      owner: diffInfo.owner,
      prNumber: diffInfo.prNumber,
      repoName: diffInfo.repoName,
      tokenBudget: this.config.tokenBudget,
    });

    try {
      const relevantFiles = diffInfo.changedFiles.filter((f) => {
        const normalizedPath = normalize(f.filename);
        if (this.isExcluded(normalizedPath)) return false;
        return f.additions + f.deletions <= 1000;
      });

      appLogger.debug({
        excluded: diffInfo.changedFiles.length - relevantFiles.length,
        msg: "pr_files_filtered",
        relevant: relevantFiles.length,
        total: diffInfo.changedFiles.length,
      });

      if (relevantFiles.length === 0) {
        appLogger.info({ msg: "pr_no_relevant_files", prNumber: diffInfo.prNumber });
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
      appLogger.info({
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
      appLogger.error({
        error: error instanceof Error ? error.message : String(error),
        msg: "pr_differential_analysis_failed",
        prNumber: diffInfo.prNumber,
      });
      throw error;
    }
  }

  private applyFocusFilters(findings: PRFinding[]): PRFinding[] {
    if (this.config.focusAreas.length === 0) return findings;

    return findings.filter((f) => this.config.focusAreas.includes(f.type));
  }

  private calculateRiskScore(findings: PRFinding[]): number {
    if (findings.length === 0) return 0;

    const avgSeverity = meanBy(findings, (f) => f.score);
    return Math.min(10, Math.ceil(avgSeverity));
  }

  private createFinding(
    file: string,
    line: number,
    content: string,
    title: string,
    score: number,
    severity: PRFinding["severity"],
    suggestion: string,
    type: PRFinding["type"] = "security"
  ): PRFinding {
    return {
      codeSnippet: content.trim(),
      file,
      line,
      message: title,
      score,
      severity,
      suggestion,
      title,
      type,
    };
  }

  private mapScoreToSeverity(score: number): PRFinding["severity"] {
    const thresholds = AI_POLICY_CONSTANTS.PR_ANALYSIS.SEVERITY_THRESHOLDS;

    if (score >= thresholds.CRITICAL) return "CRITICAL";
    if (score >= thresholds.HIGH) return "HIGH";
    if (score >= thresholds.MEDIUM) return "MEDIUM";
    return "LOW";
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

  private runSentinelPhase(files: PRDiffInfo["changedFiles"], prNumber: number): PRFinding[] {
    const findings: PRFinding[] = [];
    const { SECRETS, SQL_INJECTION, todoPatterns, VULNERABILITIES } = PROJECT_POLICY_RULES.security;

    for (const file of files) {
      if (file.patch == null) continue;

      const parsedDiff = parseGitDiff(file.patch);

      for (const parsedFile of parsedDiff.files) {
        for (const chunk of parsedFile.chunks) {
          if (!("changes" in chunk)) continue;

          for (const change of chunk.changes) {
            if (change.type !== "AddedLine") continue;

            const lineContent = change.content;
            const lineNum = change.lineAfter;

            for (const { pattern, title } of SECRETS) {
              if (pattern.test(lineContent)) {
                findings.push(
                  this.createFinding(
                    file.filename,
                    lineNum,
                    lineContent,
                    title,
                    10,
                    "CRITICAL",
                    "Немедленно удалите секрет из кода и отозовите его. Используйте Environment Variables или Secret Manager."
                  )
                );
              }
            }

            for (const { pattern, title } of VULNERABILITIES) {
              if (pattern.test(lineContent)) {
                findings.push(
                  this.createFinding(
                    file.filename,
                    lineNum,
                    lineContent,
                    title,
                    8,
                    "HIGH",
                    "Использование небезопасных функций может привести к RCE или XSS. Используйте безопасные альтернативы (например, параметризацию)."
                  )
                );
              }
            }

            for (const { pattern, title } of SQL_INJECTION) {
              if (pattern.test(lineContent)) {
                findings.push(
                  this.createFinding(
                    file.filename,
                    lineNum,
                    lineContent,
                    title,
                    9,
                    "HIGH",
                    "Обнаружена потенциальная SQL-инъекция. Используйте ORM (Prisma/Drizzle) или Parameterized Queries."
                  )
                );
              }
            }

            for (const pattern of todoPatterns) {
              if (pattern.test(lineContent)) {
                findings.push(
                  this.createFinding(
                    file.filename,
                    lineNum,
                    lineContent,
                    "TODO/FIXME marker found",
                    2,
                    "LOW",
                    "Завершите реализацию или удалите маркер перед мерджем.",
                    "style"
                  )
                );
              }
            }
          }
        }
      }
    }

    prAnalysisLogger.sentinelPhaseCompleted(prNumber, prNumber, findings.length, 0);
    return findings;
  }
}
