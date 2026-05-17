import diff_match_patch from "diff-match-patch";
import { groupBy, uniq } from "es-toolkit";

import { appLogger } from "@/server/core/app-logger";
import type { OctokitInstance } from "@/server/core/github/github-provider";
import { callWithFallback } from "@/server/utils/call";

import { AI_MODELS, SAFETY_SETTINGS } from "../ai/ai-constants";
import type { FindingForFix, GeneratedDiff } from "./pr-types";

type FixedFileContent = {
  filePath: string;
  newContent: string;
};

type FixRecommendation = {
  branch: string;
  description: string;
  diffs: GeneratedDiff[];
  estimatedImpact: number;
  fixedFiles: FixedFileContent[];
  title: string;
};

type FindingInput = {
  file: string;
  line: number;
  suggestion?: string;
  type: string;
};

const FILE_TAG_REGEX = /<file\s+path="([^"]+)">([\S\s]*?)<\/file>/g;
const MARKDOWN_CODE_WRAP_PREFIX_REGEX = /^```[a-z]*\n/i;
const MARKDOWN_CODE_WRAP_SUFFIX_REGEX = /\n```$/;

const dmp = new diff_match_patch();

class FixGenerator {
  /**
   * Генерирует компактные патчи с помощью Google Diff-Match-Patch с полной поддержкой типов
   */
  static generateDiffsFromContentPublic(
    originalContents: Record<string, string>,
    fixedFiles: FixedFileContent[]
  ): GeneratedDiff[] {
    return fixedFiles.map((file) => {
      const original = originalContents[file.filePath] ?? "";
      const newContent = file.newContent;

      const diffs = dmp.diff_main(original, newContent);

      dmp.diff_cleanupSemantic(diffs);

      const patches = dmp.patch_make(original, diffs);
      const patchText = dmp.patch_toText(patches);

      let additions = 0;
      let deletions = 0;

      for (const patchItem of patches) {
        const typedPatch = patchItem as unknown as diff_match_patch.patch_obj;

        if (Array.isArray(typedPatch.diffs)) {
          for (const [operation, text] of typedPatch.diffs) {
            if (operation === 1) {
              additions += text.split("\n").length;
            }
            if (operation === -1) {
              deletions += text.split("\n").length;
            }
          }
        }
      }

      return {
        additions,
        deletions,
        filePath: file.filePath,
        patch: patchText,
      };
    });
  }

  static generateFixRecommendations(
    findings: FindingInput[],
    fileContents: Record<string, string>
  ): FixRecommendation[] {
    const findingsByType = groupBy(findings, (f) => f.type);

    return Object.entries(findingsByType)
      .map(([type, typeFindings]) => {
        if (typeFindings.length === 0) return null;

        const config = this.getFixConfig(type, typeFindings.length);
        const affectedFiles = uniq(typeFindings.map((f) => f.file));

        const fixedFiles: FixedFileContent[] = affectedFiles.map((filePath) => ({
          filePath,
          newContent: "",
        }));

        const diffs = FixGenerator.generateDiffsFromContentPublic(fileContents, fixedFiles);

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
}

export class FixService {
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
<file path="filepath">
...full file content here...
</file>

Ensure:
1. Fixed content maintains the original file structure and imports
2. Only necessary changes to address the issues
3. All line numbers and syntax are correct
4. No partial content - always provide complete files`;
  }

  private static parseFixedCodeResponse(response: string): Record<string, string> {
    const fixedCode: Record<string, string> = {};

    FILE_TAG_REGEX.lastIndex = 0;
    let match;

    while ((match = FILE_TAG_REGEX.exec(response)) !== null) {
      const filePath = match[1]!.trim();
      let content = match[2]!.trim();

      content = content
        .replace(MARKDOWN_CODE_WRAP_PREFIX_REGEX, "")
        .replace(MARKDOWN_CODE_WRAP_SUFFIX_REGEX, "");

      if (filePath && content) {
        fixedCode[filePath] = content;
      }
    }

    return fixedCode;
  }

  async applyFix(
    octokit: OctokitInstance,
    input: {
      branch: string;
      defaultBranch: string;
      fixedFiles: FixedFileContent[];
      fixId: string;
      owner: string;
      repoId: string;
      repoName: string;
      title: string;
    }
  ): Promise<{ prNumber: number; prUrl: string }> {
    const { branch, defaultBranch, fixedFiles, owner, repoName, title } = input;

    appLogger.info({
      branch: input.branch,
      fixId: input.fixId,
      msg: "fix_applying",
      repoId: input.repoId,
    });

    const fileChanges: Record<string, string> = {};
    for (const file of fixedFiles) {
      fileChanges[file.filePath] = file.newContent;
    }

    try {
      const pr = await octokit.createPullRequest({
        base: defaultBranch,
        body: "This PR was automatically generated by Doxynix using Google Fuzzy Diff-Match-Patch to address detected issues.",
        changes: [
          {
            commit: title,
            files: fileChanges,
          },
        ],
        head: branch,
        owner,
        repo: repoName,
        title,
      });

      if (pr == null) {
        throw new Error("Failed to create pull request: received null response");
      }

      appLogger.info({
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
      appLogger.error({
        branch: input.branch,
        error: error instanceof Error ? error.message : String(error),
        fixId: input.fixId,
        msg: "fix_apply_failed",
        repoId: input.repoId,
      });
      throw error;
    }
  }

  async createFixFromAnalysis(input: {
    fileContents: Record<string, string>;
    findings: FindingForFix[];
    prAnalysisId?: string;
    repoContext: { framework?: string; language: string };
    repoId: number;
  }): Promise<{
    branch: string;
    diffs: GeneratedDiff[];
    estimatedImpact: number;
    fixedFiles: FixedFileContent[];
    title: string;
  }> {
    const recommendations = FixGenerator.generateFixRecommendations(
      input.findings,
      input.fileContents
    );

    if (recommendations.length === 0) {
      throw new Error("No fix recommendations generated");
    }

    const primary = recommendations[0]!;

    try {
      const fixPrompt = FixService.buildFixPrompt(input.findings, input.fileContents);

      const aiResponse = await callWithFallback<string>({
        attemptMetadata: {
          operation: "generate-fix",
          prAnalysisId: input.prAnalysisId,
          repoId: input.repoId,
        },
        maxOutputTokens: 65_536,
        models: AI_MODELS.POWERFUL,
        outputSchema: null,
        prompt: fixPrompt,
        providerOptions: {
          google: { safetySettings: SAFETY_SETTINGS },
        },
        system:
          'You are an expert code fixer. Provide complete, syntactically correct fixed file content. Return ONLY the fixed code wrapped in <file path="filepath"> tags.',
        taskType: "reasoning",
      });

      const fixedCodeMap = FixService.parseFixedCodeResponse(aiResponse);

      const fixedFiles = primary.fixedFiles.map((file) => ({
        filePath: file.filePath,
        newContent: fixedCodeMap[file.filePath] ?? file.newContent,
      }));

      const validFixedFiles = fixedFiles.filter((f) => f.newContent.length > 0);

      if (validFixedFiles.length === 0) {
        throw new Error("AI failed to generate any fixed file content");
      }

      const diffs = FixGenerator.generateDiffsFromContentPublic(
        input.fileContents,
        validFixedFiles
      );

      appLogger.info({
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
      appLogger.error({
        error: error instanceof Error ? error.message : String(error),
        msg: "fix_generation_failed",
        prAnalysisId: input.prAnalysisId,
        repoId: input.repoId,
      });
      throw error;
    }
  }
}
