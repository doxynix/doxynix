import * as diff from "diff";
import { groupBy, uniq } from "es-toolkit";

import { generateBranchName } from "@/shared/lib/get-branch-name";

import { appLogger } from "@/server/core/app-logger";
import type { OctokitInstance } from "@/server/core/github/github-provider";
import { callWithFallback } from "@/server/utils/call";

import { getActiveModels, SAFETY_SETTINGS } from "../ai/ai-constants";
import { buildCodeFixerSystemPrompt, buildCodeFixerUserPrompt } from "../ai/prompts-refactored";
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

const FILE_TAG_REGEX = /<file\s+path\s*=\s*["']([^"']+)["']\s*>([\S\s]*?)<\/file>/gi;

/**
 * Вспомогательные функции для нечеткого сопоставления блоков SEARCH/REPLACE
 */
function getIndent(line: string): string {
  const match = /^\s*/.exec(line);
  return match ? match[0]! : "";
}

function adjustIndentation(
  replaceLines: string[],
  searchIndent: string,
  targetIndent: string
): string[] {
  if (searchIndent === targetIndent) return replaceLines;

  return replaceLines.map((line) => {
    if (line.trim() === "") return "";

    if (line.startsWith(searchIndent)) {
      return targetIndent + line.slice(searchIndent.length);
    }
    return targetIndent + line.trimStart();
  });
}

function getTokens(line: string): string[] {
  return line
    .trim()
    .toLowerCase()
    .split(/[\s()\[\]{}.,;+\-*/=<>!]+/gu)
    .filter(Boolean);
}

function lineSimilarity(line1: string, line2: string): number {
  const t1 = getTokens(line1);
  const t2 = getTokens(line2);
  if (t1.length === 0 && t2.length === 0) return 1.0;
  if (t1.length === 0 || t2.length === 0) return 0.0;

  const set1 = new Set(t1);
  const set2 = new Set(t2);
  let intersection = 0;
  for (const token of set1) {
    if (set2.has(token)) intersection++;
  }
  const union = set1.size + set2.size - intersection;
  return intersection / union;
}

class FixGenerator {
  /**
   * Высокопроизводительный однопроходный расчет диффов с разгрузкой Event Loop.
   */
  static async generateDiffsFromContentPublic(
    originalContents: Record<string, string>,
    fixedFiles: FixedFileContent[]
  ): Promise<GeneratedDiff[]> {
    const diffs: GeneratedDiff[] = [];

    for (const file of fixedFiles) {
      const original = originalContents[file.filePath] ?? "";
      const newContent = file.newContent;

      if (original === newContent) {
        diffs.push({
          additions: 0,
          deletions: 0,
          filePath: file.filePath,
          patch: "",
        });
        continue;
      }

      const patchText = diff.createTwoFilesPatch(
        file.filePath,
        file.filePath,
        original,
        newContent,
        "Original",
        "AI Fixed"
      );

      let additions = 0;
      let deletions = 0;

      const lines = patchText.split("\n");
      for (let i = 4; i < lines.length; i++) {
        const line = lines[i];
        if (line == null) continue;
        if (line.startsWith("+") && !line.startsWith("+++")) {
          additions++;
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          deletions++;
        }
      }

      diffs.push({
        additions,
        deletions,
        filePath: file.filePath,
        patch: patchText,
      });

      await new Promise((resolve) => setImmediate(resolve));
    }

    return diffs;
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

        const diffs: GeneratedDiff[] = affectedFiles.map((filePath) => ({
          additions: 0,
          deletions: 0,
          filePath,
          patch: "",
        }));

        return {
          branch: generateBranchName(),
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
  /**
   * Применяет Search-and-Replace блоки к коду, используя каскадный отказоустойчивый поиск
   */
  private static applySearchReplace(original: string, response: string, filePath: string): string {
    const blockRegex =
      /<{7} (SEARCH|ORIGINAL)\r?\n([\S\s]*?)\r?\n={7}\r?\n([\S\s]*?)\r?\n>{7} (REPLACE|UPDATED)/g;

    let fileContent = original.replaceAll("\r\n", "\n");
    let match;
    let appliedCount = 0;

    blockRegex.lastIndex = 0;
    while ((match = blockRegex.exec(response)) !== null) {
      const searchBlock = match[2];
      const replaceBlock = match[3];

      if (searchBlock == null || replaceBlock == null) continue;

      const normalizedSearch = searchBlock.replaceAll("\r\n", "\n");
      const normalizedReplace = replaceBlock.replaceAll("\r\n", "\n");

      if (fileContent.includes(normalizedSearch)) {
        fileContent = fileContent.replace(normalizedSearch, normalizedReplace);
        appliedCount++;
        continue;
      }

      const searchLines = normalizedSearch.split("\n");
      const fileLines = fileContent.split("\n");

      let matchedIndex = -1;
      let matchedIndent = "";
      let originalSearchIndent = "";

      const firstNonEmptySearchLine = searchLines.find((l) => l.trim() !== "") ?? "";
      originalSearchIndent = getIndent(firstNonEmptySearchLine);

      for (let i = 0; i <= fileLines.length - searchLines.length; i++) {
        let isMatch = true;
        let detectedIndent = "";

        for (let j = 0; j < searchLines.length; j++) {
          const sLine = searchLines[j]!;
          const fLine = fileLines[i + j]!;

          if (sLine.trim() === "" && fLine.trim() === "") continue;

          if (sLine.trim() === "" || fLine.trim() === "") {
            isMatch = false;
            break;
          }

          if (sLine.trim() !== fLine.trim()) {
            isMatch = false;
            break;
          }

          if (detectedIndent === "" && fLine.trim() !== "") {
            detectedIndent = getIndent(fLine);
          }
        }

        if (isMatch) {
          matchedIndex = i;
          matchedIndent = detectedIndent;
          break;
        }
      }

      if (matchedIndex !== -1) {
        const adjustedReplaceLines = adjustIndentation(
          normalizedReplace.split("\n"),
          originalSearchIndent,
          matchedIndent
        );

        fileLines.splice(matchedIndex, searchLines.length, ...adjustedReplaceLines);
        fileContent = fileLines.join("\n");
        appliedCount++;
        continue;
      }

      let bestIndex = -1;
      let bestScore = 0;
      let bestWindowIndent = "";

      for (let i = 0; i <= fileLines.length - searchLines.length; i++) {
        let totalScore = 0;
        let detectedIndent = "";

        for (let j = 0; j < searchLines.length; j++) {
          const sLine = searchLines[j]!;
          const fLine = fileLines[i + j]!;

          if (sLine.trim() === "" && fLine.trim() === "") {
            totalScore += 1.0;
            continue;
          }

          totalScore += lineSimilarity(sLine, fLine);

          if (detectedIndent === "" && fLine.trim() !== "") {
            detectedIndent = getIndent(fLine);
          }
        }

        const avgScore = totalScore / searchLines.length;
        if (avgScore > bestScore && avgScore > 0.75) {
          bestScore = avgScore;
          bestIndex = i;
          bestWindowIndent = detectedIndent;
        }
      }

      if (bestIndex !== -1) {
        appLogger.info({
          filePath,
          msg: `Fuzzy search-replace applied successfully (similarity score: ${Math.round(bestScore * 100)}%)`,
        });

        const adjustedReplaceLines = adjustIndentation(
          normalizedReplace.split("\n"),
          originalSearchIndent,
          bestWindowIndent
        );

        fileLines.splice(bestIndex, searchLines.length, ...adjustedReplaceLines);
        fileContent = fileLines.join("\n");
        appliedCount++;
        continue;
      }

      appLogger.error({
        failedSearchBlock: searchBlock.slice(0, 250),
        filePath,
        msg: "Surgical block match failed. Search content did not match any section.",
      });
    }

    return fileContent;
  }

  /**
   * Парсит ответ модели и применяет хирургические изменения
   */
  private static parseFixedCodeResponse(
    response: string,
    originalContents: Record<string, string>
  ): Record<string, string> {
    const fixedCode: Record<string, string> = {};

    FILE_TAG_REGEX.lastIndex = 0;
    let match;

    while ((match = FILE_TAG_REGEX.exec(response)) !== null) {
      const filePath = match[1]!.trim();
      const sAndRBlocks = match[2]!.trim();
      const originalContent = originalContents[filePath];

      if (filePath && sAndRBlocks && originalContent != null) {
        fixedCode[filePath] = this.applySearchReplace(originalContent, sAndRBlocks, filePath);
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
        body: "This PR was automatically generated by Doxynix.",
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
        update: true,
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
    repoId: number | string;
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
      const systemPrompt = buildCodeFixerSystemPrompt(input.repoContext.language || "English");
      const userPrompt = buildCodeFixerUserPrompt(input.findings, input.fileContents);

      const activeModels = await getActiveModels();

      const aiResponse = await callWithFallback<string>({
        attemptMetadata: {
          operation: "generate-fix",
          prAnalysisId: input.prAnalysisId,
          repoId: String(input.repoId),
        },
        models: activeModels.POWERFUL,
        outputSchema: null,
        prompt: userPrompt,
        providerOptions: {
          google: { safetySettings: SAFETY_SETTINGS },
        },
        stream: false,
        system: systemPrompt,
        taskType: "classification",
      });

      const fixedCodeMap = FixService.parseFixedCodeResponse(aiResponse, input.fileContents);

      const fixedFiles = primary.fixedFiles.map((file) => ({
        filePath: file.filePath,
        newContent: fixedCodeMap[file.filePath] ?? file.newContent,
      }));

      const validFixedFiles = fixedFiles.filter((f) => f.newContent.length > 0);

      if (validFixedFiles.length === 0) {
        throw new Error("AI failed to generate any fixed file content");
      }

      const diffs = await FixGenerator.generateDiffsFromContentPublic(
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
