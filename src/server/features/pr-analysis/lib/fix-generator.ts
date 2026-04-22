import { groupBy } from "es-toolkit";
import { z } from "zod";

import type { FindingForFix, GeneratedDiff } from "@/server/features/pr-analysis/model/pr-types";
import type { OctokitInstance } from "@/server/shared/infrastructure/github/github-provider";
import { logger } from "@/server/shared/infrastructure/logger";
import { callWithFallback } from "@/server/shared/lib/call";

import { AI_MODELS, SAFETY_SETTINGS } from "../../analyze-repo/lib/constants";

/**
 * Full file content after AI fixing (from AI response)
 */
export interface FixedFileContent {
  filePath: string;
  newContent: string; // Full file content, not a patch
}

export interface FixRecommendation {
  branch: string;
  description: string;
  diffs: GeneratedDiff[];
  estimatedImpact: number;
  fixedFiles: FixedFileContent[]; // NEW: Full content for each file
  title: string;
}

export interface FindingInput {
  file: string;
  line: number;
  suggestion?: string;
  type: string;
}

/**
 * Schema for AI-generated fixed code response.
 * AI returns full file content wrapped in <fixed_code>filepath</fixed_code>...content...</fixed_code>
 * (Currently unused - using regex parsing instead for flexibility)
 */
const _FixedCodeResponseSchema = z.object({
  fixedCode: z.record(
    z.string(), // filePath
    z.string() // file content
  ),
  rationale: z.string().optional(),
});

/**
 * Generates code fixes for detected issues using "Full Content Replacement" strategy.
 * AI returns entire fixed file content (wrapped in <fixed_code> tags).
 * No .patch parsing complexity.
 */
export class FixGenerator {
  /**
   * Generate fix recommendations from findings + original file contents.
   * AI will return full fixed content for each affected file.
   * Frontend sends both diffs (preview) and fixed content (application) to applyFix.
   *
   * @param findings Issues detected in PR
   * @param fileContents Map of file paths to original content
   * @returns Fix recommendations with diffs for preview and full content for application
   */
  static generateFixRecommendations(
    findings: FindingInput[],
    fileContents: Record<string, string>
  ): FixRecommendation[] {
    // Group findings by type for recommendation batching
    const findingsByType = groupBy(findings, (f) => f.type);

    return Object.entries(findingsByType)
      .map(([type, typeFindings]) => {
        if (typeFindings.length === 0) return null;

        const config = this.getFixConfig(type, typeFindings.length);
        const affectedFiles = [...new Set(typeFindings.map((f) => f.file))];

        // NEW: Will be populated from AI response (in FixService)
        const fixedFiles: FixedFileContent[] = affectedFiles.map((filePath) => ({
          filePath,
          newContent: "", // Will be filled by AI in createFixFromAnalysis
        }));

        // Generate placeholder diffs for now (will be updated with actual content in applyFix)
        const diffs = this.generateDiffsFromContent(fileContents, fixedFiles);

        return {
          branch: `fix/${type}-${Date.now()}`,
          description: config.description,
          diffs,
          estimatedImpact: config.estimatedImpact,
          fixedFiles,
          title: config.title,
        };
      })
      .filter((fix): fix is FixRecommendation => fix !== null);
  }

  private static getFixConfig(type: string, count: number) {
    // ... existing code ...
    const map: Record<string, { description: string; estimatedImpact: number; title: string }> = {
      complexity: {
        description: `Refactors ${count} complex function(s)`,
        estimatedImpact: 40,
        title: "Reduce Complexity",
      },
      performance: {
        description: `Improves performance in ${count} location(s)`,
        estimatedImpact: 60,
        title: "Optimize Performance",
      },
      security: {
        description: `Addresses ${count} security vulnerability(ies) found during analysis`,
        estimatedImpact: 85,
        title: "Fix Security Issues",
      },
      style: {
        description: `Applies consistent code style to ${count} file(s)`,
        estimatedImpact: 20,
        title: "Code Style & Formatting",
      },
    };

    return (
      map[type] ?? {
        description: `Automated fixes for ${count} ${type} findings`,
        estimatedImpact: 30,
        title: `Fix ${type} issues`,
      }
    );
  }

  /**
   * Generate unified diffs by comparing original vs fixed content.
   * For now, returns placeholder diffs. Frontend will use jsdiff for preview.
   */
  private static generateDiffsFromContent(
    originalContents: Record<string, string>,
    fixedFiles: FixedFileContent[]
  ): GeneratedDiff[] {
    return FixGenerator.generateDiffsFromContentPublic(originalContents, fixedFiles);
  }

  /**
   * Public utility for diff generation (used by FixService).
   */
  static generateDiffsFromContentPublic(
    originalContents: Record<string, string>,
    fixedFiles: FixedFileContent[]
  ): GeneratedDiff[] {
    return fixedFiles.map((file) => {
      const original = originalContents[file.filePath] ?? "";
      const newContent = file.newContent;

      // Simple line-by-line diff (frontend will use jsdiff for rich preview)
      const originalLines = original.split("\n");
      const newLines = newContent.split("\n");

      // Placeholder patch - frontend will generate actual diff for UI
      const patch = FixGenerator.generateSimplePatch(file.filePath, originalLines, newLines);

      return {
        additions: newLines.length,
        deletions: originalLines.length,
        filePath: file.filePath,
        patch,
      };
    });
  }

  private static generateSimplePatch(
    filePath: string,
    originalLines: string[],
    newLines: string[]
  ): string {
    // Placeholder: actual diff generation happens on frontend with jsdiff
    const summary = `--- a/${filePath}\n+++ b/${filePath}\n`;
    return (
      summary +
      `@@ -1,${originalLines.length} +1,${newLines.length} @@\n` +
      `// AI-generated fix. Frontend will compute actual diff.\n`
    );
  }
}

/**
 * Service for creating and applying fixes (stateless full-content strategy).
 * Uses octokit-plugin-create-pull-request for atomic PR creation.
 * Orchestrates AI prompting and GitHub integration.
 */
export class FixService {
  /**
   * Build AI prompt asking for full fixed file content.
   * Returns prompt wrapped in <fixed_code> tags per finding.
   */
  private static buildFixPrompt(
    findings: FindingInput[],
    fileContents: Record<string, string>
  ): string {
    const findingsByFile = groupBy(findings, (f) => f.file);
    const findingDetails = Object.entries(findingsByFile)
      .map(([filePath, fileFindings]) => {
        const content = fileContents[filePath] ?? "(file not provided)";
        const issues = fileFindings
          .map((f) => `  - Line ${f.line} (${f.type}): ${f.suggestion ?? "Issue detected"}`)
          .join("\n");
        return `\n## File: ${filePath}\n${issues}\n\nOriginal:\n\`\`\`\n${content}\n\`\`\``;
      })
      .join("\n");

    return `You are a professional code fixer. Analyze the detected issues in each file and provide the full fixed content.

${findingDetails}

For each file with issues, provide the COMPLETE fixed file content wrapped in:
<fixed_code>filepath</fixed_code>
...full file content here...
</fixed_code>

Ensure:
1. Fixed content maintains the original file structure and imports
2. Only necessary changes to address the issues
3. All line numbers and syntax are correct
4. No partial content - always provide complete files`;
  }

  /**
   * Parse AI response to extract fixed file contents.
   * Looks for <fixed_code>filepath</fixed_code>...content...</fixed_code> patterns.
   */
  private static parseFixedCodeResponse(response: string): Record<string, string> {
    const fixedCode: Record<string, string> = {};

    // Match <fixed_code>filepath</fixed_code>...content...</fixed_code>
    const tagRegex = /<fixed_code>([^<]+)<\/fixed_code>([\S\s]*?)<\/fixed_code>/g;
    let match;

    while ((match = tagRegex.exec(response)) !== null) {
      const filePath = match[1]!.trim();
      const content = match[2]!.trim();
      if (filePath && content) {
        fixedCode[filePath] = content;
      }
    }

    return fixedCode;
  }

  /**
   * Generate fix from findings via AI.
   * AI returns full file content wrapped in <fixed_code> tags.
   * Returns in-memory diffs (not persisted).
   */
  async createFixFromAnalysis(input: {
    fileContents: Record<string, string>; // Original file contents
    findings: FindingForFix[];
    prAnalysisId?: number;
    repoContext: { framework?: string; language: string };
    repoId: number;
  }): Promise<{
    branch: string;
    diffs: GeneratedDiff[];
    estimatedImpact: number;
    fixedFiles: FixedFileContent[]; // Full content for each file
    title: string;
  }> {
    const recommendations = FixGenerator.generateFixRecommendations(
      input.findings,
      input.fileContents
    );

    if (recommendations.length === 0) {
      throw new Error("No fix recommendations generated");
    }

    // Use first recommendation as primary
    const primary = recommendations[0]!;

    try {
      // Call AI to generate full fixed content
      const fixPrompt = FixService.buildFixPrompt(input.findings, input.fileContents);

      const aiResponse = await callWithFallback<string>({
        attemptMetadata: {
          operation: "generate-fix",
          prAnalysisId: input.prAnalysisId,
          repoId: input.repoId,
        },
        maxOutputTokens: 65_536,
        models: AI_MODELS.POWERFUL,
        outputSchema: null, // Raw string response
        prompt: fixPrompt,
        providerOptions: {
          google: { codeExecution: false, safetySettings: SAFETY_SETTINGS },
        },
        system:
          "You are an expert code fixer. Provide complete, syntactically correct fixed file content. Return ONLY the fixed code wrapped in <fixed_code> tags.",
        taskType: "default",
        temperature: 0.3, // Lower temperature for code generation
      });

      // Parse AI response to extract fixed files
      const fixedCodeMap = FixService.parseFixedCodeResponse(aiResponse);

      // Populate fixedFiles with AI-generated content
      const fixedFiles = primary.fixedFiles.map((file) => ({
        filePath: file.filePath,
        newContent: fixedCodeMap[file.filePath] ?? file.newContent,
      }));

      // Filter out files with empty content
      const validFixedFiles = fixedFiles.filter((f) => f.newContent.length > 0);

      if (validFixedFiles.length === 0) {
        throw new Error("AI failed to generate any fixed file content");
      }

      // Regenerate diffs with actual fixed content
      const diffs = FixGenerator.generateDiffsFromContentPublic(
        input.fileContents,
        validFixedFiles
      );

      logger.info({
        branch: primary.branch,
        fixedFileCount: validFixedFiles.length,
        impact: primary.estimatedImpact,
        msg: "fix_generated_from_ai",
        repoId: input.repoId,
        title: primary.title,
      });

      return {
        branch: primary.branch,
        diffs,
        estimatedImpact: primary.estimatedImpact,
        fixedFiles: validFixedFiles,
        title: primary.title,
      };
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        msg: "fix_generation_failed",
        prAnalysisId: input.prAnalysisId,
        repoId: input.repoId,
      });
      throw error;
    }
  }

  /**
   * Apply fix to repository using atomic PR creation.
   * Frontend sends back the fixed file contents (newContent for each file).
   * Uses octokit.createPullRequest() plugin for atomic operation.
   *
   * @param octokit GitHub API client with create-pull-request plugin
   * @param input Fixed files + repo info
   * @returns GitHub PR metadata
   */
  async applyFix(
    octokit: OctokitInstance,
    input: {
      branch: string;
      defaultBranch: string; // Use repo's actual default branch
      fixedFiles: FixedFileContent[]; // Full content, not patches
      fixId: number;
      owner: string;
      repoId: number;
      repoName: string;
      title: string;
    }
  ): Promise<{ prNumber: number; prUrl: string }> {
    const { branch, defaultBranch, fixedFiles, owner, repoName, title } = input;

    logger.info({
      branch: input.branch,
      fixId: input.fixId,
      msg: "fix_applying",
      repoId: input.repoId,
    });

    // Build file changes object for createPullRequest plugin
    const fileChanges: Record<string, string> = {};
    for (const file of fixedFiles) {
      fileChanges[file.filePath] = file.newContent;
    }

    try {
      // Use octokit plugin for atomic operation: create branch + commit files + open PR
      const pr = await octokit.createPullRequest({
        base: defaultBranch,
        body: "This PR was automatically generated by Doxynix to address detected issues.",
        changes: [
          {
            commit: `[Doxynix] ${title}`,
            files: fileChanges,
          },
        ],
        head: branch,
        owner,
        repo: repoName,
        title: `[Doxynix] ${title}`,
      });

      if (pr == null) {
        throw new Error("Failed to create pull request: received null response");
      }

      logger.info({
        branch: input.branch,
        fixId: input.fixId,
        msg: "fix_applied",
        prNumber: pr.data.number,
        repoId: input.repoId,
      });

      return {
        prNumber: pr.data.number,
        prUrl: pr.data.html_url,
      };
    } catch (error) {
      logger.error({
        branch: input.branch,
        error: error instanceof Error ? error.message : String(error),
        fixId: input.fixId,
        msg: "fix_apply_failed",
        repoId: input.repoId,
      });
      throw error;
    }
  }
}
