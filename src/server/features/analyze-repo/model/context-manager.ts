import { FileClassifier } from "@/server/shared/engine/core/file-classifier";

import { cleanCodeForAi } from "../../../shared/lib/optimizers";
import { escapePromptXmlAttr, escapePromptXmlText } from "../../../shared/lib/prompt-xml";

type FileEntry = { content: string; path: string };

export type AiContextStage = "architect" | "writer_api" | "writer_architecture" | "writer_readme";

export type ContextDropReason =
  | "budget"
  | "empty-after-clean"
  | "secondary-no-budget"
  | "sensitive"
  | "stage-filter";

export type StageContextDebugEntry = {
  chars: number;
  path: string;
  reason: string;
  score: number;
  truncated: boolean;
};

export type StageContextDropEntry = {
  path: string;
  reason: ContextDropReason;
  score: number;
};

export type StageContextSelection = {
  budgetChars: number;
  dropped: StageContextDropEntry[];
  overflowPrevented: boolean;
  selected: StageContextDebugEntry[];
  selectedChars: number;
  selectedEvidencePaths: string[];
  stage: AiContextStage;
};

export type StageContextPack = {
  context: string;
  debug: StageContextSelection;
};

type StageContextParams = {
  files: FileEntry[];
  maxChars?: number;
  preferredPaths?: string[];
  stage: AiContextStage;
};

const STAGE_BUDGETS: Record<AiContextStage, number> = {
  architect: 220_000,
  writer_api: 120_000,
  writer_architecture: 110_000,
  writer_readme: 80_000,
};

const STAGE_FILE_LIMITS: Record<AiContextStage, number> = {
  architect: 12_000,
  writer_api: 16_000,
  writer_architecture: 14_000,
  writer_readme: 10_000,
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

function uniquePaths(paths: string[]) {
  return Array.from(new Set(paths.filter((value) => value.length > 0)));
}

function truncateSnippet(content: string, limit: number) {
  if (content.length <= limit) {
    return { content, truncated: false };
  }

  return {
    content: `${content.slice(0, limit)}\n/* ...truncated for AI budget... */`,
    truncated: true,
  };
}

function stageAllowsFile(stage: AiContextStage, filePath: string, preferred: boolean) {
  if (FileClassifier.isSensitiveFile(filePath)) return false;
  if (FileClassifier.isGeneratedFile(filePath) || FileClassifier.isAssetFile(filePath))
    return false;
  if (preferred) return true;

  const docsLike = FileClassifier.isDocsFile(filePath) || isExampleLike(filePath);
  const testLike = FileClassifier.isTestFile(filePath);
  const benchmarkLike = FileClassifier.isBenchmarkFile(filePath);

  switch (stage) {
    case "architect":
    case "writer_architecture":
      if (docsLike || testLike || benchmarkLike) return false;
      return (
        FileClassifier.isPrimaryArchitectureFile(filePath) ||
        FileClassifier.isConfigFile(filePath) ||
        isRootManifest(filePath)
      );
    case "writer_api":
      if (docsLike || testLike || benchmarkLike) return false;
      return (
        FileClassifier.isApiFile(filePath) ||
        FileClassifier.isPrimaryArchitectureFile(filePath) ||
        isRootManifest(filePath)
      );
    case "writer_readme":
      if (benchmarkLike) return false;
      if (testLike) return false;
      return (
        FileClassifier.isConfigFile(filePath) ||
        FileClassifier.isPrimaryArchitectureFile(filePath) ||
        isRootManifest(filePath)
      );
  }
}

function scoreFile(stage: AiContextStage, filePath: string, preferred: boolean) {
  let score = FileClassifier.getScore(filePath);

  if (preferred) score += 80;
  if (isRootManifest(filePath)) score += 30;
  if (FileClassifier.isPrimaryArchitectureFile(filePath)) score += 20;
  if (FileClassifier.isConfigFile(filePath)) score += stage === "writer_readme" ? 25 : 10;
  if (stage === "writer_api" && FileClassifier.isApiFile(filePath)) score += 35;
  if (stage === "architect" && FileClassifier.isApiFile(filePath)) score += 15;
  if ((FileClassifier.isDocsFile(filePath) || isExampleLike(filePath)) && !preferred) score -= 50;
  if (FileClassifier.isTestFile(filePath) && !preferred) score -= 60;

  return score;
}

function buildSelectionReason(stage: AiContextStage, filePath: string, preferred: boolean) {
  if (preferred) return "preferred-evidence";
  if (isRootManifest(filePath)) return "root-manifest";
  if (FileClassifier.isConfigFile(filePath))
    return stage === "writer_readme" ? "config-evidence" : "config-support";
  if (stage === "writer_api" && FileClassifier.isApiFile(filePath)) return "api-evidence";
  if (FileClassifier.isPrimaryArchitectureFile(filePath)) return "primary-architecture";
  return "secondary-support";
}

export function buildStageContextPack({
  files,
  maxChars,
  preferredPaths = [],
  stage,
}: StageContextParams): StageContextPack {
  const preferredSet = new Set(preferredPaths);
  const budgetChars = maxChars ?? STAGE_BUDGETS[stage];
  const perFileLimit = STAGE_FILE_LIMITS[stage];
  const dropped: StageContextDropEntry[] = [];

  const candidates = files
    .map((file) => {
      const preferred = preferredSet.has(file.path);
      const lowerPath = file.path.toLowerCase();

      if (FileClassifier.isSensitiveFile(lowerPath)) {
        dropped.push({ path: file.path, reason: "sensitive", score: 0 });
        return null;
      }

      if (!stageAllowsFile(stage, lowerPath, preferred)) {
        dropped.push({ path: file.path, reason: "stage-filter", score: 0 });
        return null;
      }

      const cleaned = cleanCodeForAi(file.content, file.path).trim();
      if (cleaned.length === 0) {
        dropped.push({ path: file.path, reason: "empty-after-clean", score: 0 });
        return null;
      }

      const snippet = truncateSnippet(cleaned, perFileLimit);
      const xml = `<file path="${escapePromptXmlAttr(file.path)}">\n${escapePromptXmlText(snippet.content)}\n</file>`;
      const score = scoreFile(stage, lowerPath, preferred);

      return {
        chars: xml.length,
        path: file.path,
        preferred,
        reason: buildSelectionReason(stage, lowerPath, preferred),
        score,
        truncated: snippet.truncated,
        xml,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate != null);

  candidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.chars - right.chars;
  });

  const selected: StageContextDebugEntry[] = [];
  const selectedXml: string[] = [];
  let selectedChars = 0;
  let overflowPrevented = false;

  for (const candidate of candidates) {
    if (selectedChars + candidate.chars > budgetChars) {
      dropped.push({
        path: candidate.path,
        reason: candidate.preferred ? "budget" : "secondary-no-budget",
        score: candidate.score,
      });
      overflowPrevented = true;
      continue;
    }

    selected.push({
      chars: candidate.chars,
      path: candidate.path,
      reason: candidate.reason,
      score: candidate.score,
      truncated: candidate.truncated,
    });
    selectedXml.push(candidate.xml);
    selectedChars += candidate.chars;
  }

  return {
    context: selectedXml.join("\n\n"),
    debug: {
      budgetChars,
      dropped,
      overflowPrevented,
      selected,
      selectedChars,
      selectedEvidencePaths: uniquePaths(selected.map((entry) => entry.path)),
      stage,
    },
  };
}

export function prepareSmartContext(
  files: FileEntry[],
  maxChars: number = STAGE_BUDGETS.architect
): string {
  return buildStageContextPack({
    files,
    maxChars,
    stage: "architect",
  }).context;
}
