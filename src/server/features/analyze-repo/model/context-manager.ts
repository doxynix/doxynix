import type { Module } from "@/server/shared/engine/core/discovery.types";
import { getFileScore } from "@/server/shared/engine/core/file-classifier";
import { ProjectPolicy } from "@/server/shared/engine/core/project-policy";
import { FILE_CONTEXT_MODIFIERS } from "@/server/shared/engine/core/scoring-constants";
import { cleanCodeForAi, skeletonizeCode } from "@/server/shared/lib/optimizers";
import { escapePromptXmlAttr, escapePromptXmlText } from "@/server/shared/lib/string-utils";
import { countTokens } from "@/server/shared/lib/tokenizer";

export type AiContextStage = "architect" | "writer_api" | "writer_architecture" | "writer_readme";

export type ContextDropReason =
  | "budget"
  | "empty-after-clean"
  | "secondary-no-budget"
  | "sensitive"
  | "stage-filter";

export type StageContextDebugEntry = {
  path: string;
  reason: string;
  score: number;
  tokens: number;
  truncated: boolean;
};

export type StageContextDropEntry = {
  path: string;
  reason: ContextDropReason;
  score: number;
};

export type StageContextSelection = {
  budgetChars: any;
  budgetTokens: number;
  dropped: StageContextDropEntry[];
  overflowPrevented: boolean;
  selected: StageContextDebugEntry[];
  selectedChars: any;
  selectedEvidencePaths: string[];
  selectedTokens: number;
  stage: AiContextStage;
};

export type StageContextPack = {
  context: string;
  debug: StageContextSelection;
};

type StageContextParams = {
  files: Module[];
  maxTokens?: number;
  preferredPaths?: string[];
  stage: AiContextStage;
};

const STAGE_TOKEN_BUDGETS: Record<AiContextStage, number> = {
  architect: 210_000,
  writer_api: 180_000,
  writer_architecture: 180_000,
  writer_readme: 150_000,
};

const STAGE_FILE_TOKEN_LIMITS: Record<AiContextStage, number> = {
  architect: 4000,
  writer_api: 6000,
  writer_architecture: 5000,
  writer_readme: 3500,
};

const ROOT_MANIFESTS = new Set([
  "cargo.toml",
  "go.mod",
  "package.json",
  "pom.xml",
  "pyproject.toml",
  "readme.md",
  "requirements.txt",
  "setup.py",
  "tsconfig.json",
]);

function isExampleLike(path: string) {
  return /(^|\/)(example|examples|sample|samples)\//iu.test(path);
}

function isRootManifest(path: string) {
  return !path.includes("/") && ROOT_MANIFESTS.has(path.toLowerCase());
}

function stageAllowsFile(stage: AiContextStage, filePath: string, preferred: boolean) {
  if (ProjectPolicy.isSensitive(filePath)) return false;
  if (ProjectPolicy.isGeneratedFile(filePath) || ProjectPolicy.isAssetFile(filePath)) return false;
  if (preferred) return true;

  const docsLike = ProjectPolicy.isDocsFile(filePath) || isExampleLike(filePath);
  const testLike = ProjectPolicy.isTestFile(filePath);
  const benchmarkLike = ProjectPolicy.isBenchmarkFile(filePath);

  switch (stage) {
    case "architect":
    case "writer_architecture": {
      if (docsLike || testLike || benchmarkLike) return false;
      return (
        ProjectPolicy.isPrimaryArchitecturePath(filePath) ||
        ProjectPolicy.isConfigFile(filePath) ||
        isRootManifest(filePath)
      );
    }
    case "writer_api": {
      return (
        ProjectPolicy.isApiPath(filePath) ||
        ProjectPolicy.isPrimaryArchitecturePath(filePath) ||
        isRootManifest(filePath)
      );
    }
    case "writer_readme": {
      return (
        ProjectPolicy.isConfigFile(filePath) ||
        ProjectPolicy.isPrimaryArchitecturePath(filePath) ||
        isRootManifest(filePath)
      );
    }
  }
}

function scoreFile(stage: AiContextStage, filePath: string, preferred: boolean) {
  let score = getFileScore(filePath);

  if (preferred) score += FILE_CONTEXT_MODIFIERS.preferredFileBonus;
  if (isRootManifest(filePath)) score += FILE_CONTEXT_MODIFIERS.rootManifestBonus;
  if (ProjectPolicy.isPrimaryArchitecturePath(filePath))
    score += FILE_CONTEXT_MODIFIERS.primaryArchitectureBonus;
  if (ProjectPolicy.isConfigFile(filePath)) {
    score +=
      stage === "writer_readme"
        ? FILE_CONTEXT_MODIFIERS.configFileBonusForReadme
        : FILE_CONTEXT_MODIFIERS.configFileBonus;
  }
  if (stage === "writer_api" && ProjectPolicy.isApiPath(filePath))
    score += FILE_CONTEXT_MODIFIERS.apiFileBonus;
  if (stage === "architect" && ProjectPolicy.isApiPath(filePath))
    score += FILE_CONTEXT_MODIFIERS.apiFileSecondaryBonus;
  if ((ProjectPolicy.isDocsFile(filePath) || isExampleLike(filePath)) && !preferred)
    score += FILE_CONTEXT_MODIFIERS.docFilePenalty;
  if (ProjectPolicy.isTestFile(filePath) && !preferred)
    score += FILE_CONTEXT_MODIFIERS.testFilePenalty;

  return score;
}

function buildSelectionReason(stage: AiContextStage, filePath: string, preferred: boolean) {
  if (preferred) return "preferred-evidence";
  if (isRootManifest(filePath)) return "root-manifest";
  if (ProjectPolicy.isConfigFile(filePath))
    return stage === "writer_readme" ? "config-evidence" : "config-support";
  if (stage === "writer_api" && ProjectPolicy.isApiPath(filePath)) return "api-evidence";
  if (ProjectPolicy.isPrimaryArchitecturePath(filePath)) return "primary-architecture";
  return "secondary-support";
}

export async function buildStageContextPack({
  files,
  maxTokens,
  preferredPaths = [],
  stage,
}: StageContextParams): Promise<StageContextPack> {
  const preferredSet = new Set(preferredPaths);
  const budgetTokens = maxTokens ?? STAGE_TOKEN_BUDGETS[stage];
  const perFileTokenLimit = STAGE_FILE_TOKEN_LIMITS[stage];
  const dropped: StageContextDropEntry[] = [];

  const candidates = files
    .map((file) => {
      const lowerPath = file.path.toLowerCase();
      const preferred = preferredSet.has(file.path);

      if (ProjectPolicy.isSensitive(lowerPath)) {
        dropped.push({ path: file.path, reason: "sensitive", score: 0 });
        return null;
      }

      if (!stageAllowsFile(stage, lowerPath, preferred)) {
        dropped.push({ path: file.path, reason: "stage-filter", score: 0 });
        return null;
      }

      return {
        file,
        path: file.path,
        preferred,
        score: scoreFile(stage, lowerPath, preferred),
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.score - a.score);

  const selected: StageContextDebugEntry[] = [];
  const selectedXml: string[] = [];
  let currentTotalTokens = 0;

  for (const item of candidates) {
    if (currentTotalTokens >= budgetTokens) {
      dropped.push({ path: item.path, reason: "budget", score: item.score });
      continue;
    }

    let content = cleanCodeForAi(item.file.content ?? "", item.path).trim();
    if (!content) {
      dropped.push({ path: item.path, reason: "empty-after-clean", score: item.score });
      continue;
    }

    let fileTokens = await countTokens(content);
    let isTruncated = false;

    if (fileTokens > perFileTokenLimit) {
      content = skeletonizeCode(content);
      fileTokens = await countTokens(content);
      isTruncated = true;
    }

    const xml = `<file path="${escapePromptXmlAttr(item.path)}">\n${escapePromptXmlText(content)}\n</file>`;
    const totalWithXmlTokens = fileTokens + 15;

    if (currentTotalTokens + totalWithXmlTokens > budgetTokens) {
      if (item.preferred) {
        content = content.slice(0, 500) + "\n/* ...emergency truncated... */";
        const emergencyTokens = (await countTokens(content)) + 15;
        if (currentTotalTokens + emergencyTokens <= budgetTokens) {
          addFileToContext(item, buildXml(item.path, content), emergencyTokens, true);
          continue;
        }
      }

      dropped.push({ path: item.path, reason: "secondary-no-budget", score: item.score });
      continue;
    }

    addFileToContext(item, xml, totalWithXmlTokens, isTruncated);
  }

  function addFileToContext(item: any, xml: string, tokens: number, truncated: boolean) {
    selected.push({
      path: item.path,
      reason: buildSelectionReason(stage, item.path.toLowerCase(), item.preferred),
      score: item.score,
      tokens,
      truncated,
    });
    selectedXml.push(xml);
    currentTotalTokens += tokens;
  }

  return {
    context: selectedXml.join("\n\n"),
    debug: {
      budgetChars: undefined,
      budgetTokens,
      dropped,
      overflowPrevented: dropped.some((d) => d.reason === "budget"),
      selected,
      selectedChars: undefined,
      selectedEvidencePaths: selected.map((s) => s.path),
      selectedTokens: currentTotalTokens,
      stage,
    },
  };
}

function buildXml(path: string, content: string) {
  return `<file path="${escapePromptXmlAttr(path)}">\n${escapePromptXmlText(content)}\n</file>`;
}

export async function prepareSmartContext(files: Module[], maxTokens?: number): Promise<string> {
  const result = await buildStageContextPack({
    files,
    maxTokens,
    stage: "architect",
  });
  return result.context;
}
