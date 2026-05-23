import type { IClone, IMapFrame, IOptions } from "@jscpd/core";
import { clamp } from "es-toolkit";

import type { RepositoryFile } from "../core/discovery.types";
import { ProjectPolicy } from "../core/project-policy";
import { PROJECT_POLICY_RULES } from "../core/project-policy-rules";

export type DuplicationReport = {
  clones: Array<{
    fragmentPreview: string;
    lines: number;
    primary: {
      endLine: number;
      path: string;
      startLine: number;
    };
    secondary: {
      endLine: number;
      path: string;
      startLine: number;
    };
  }>;
  duplicationPercentage: number;
  totalDuplicatedLines: number;
};

type DuplicationSourceFile = RepositoryFile & {
  format: string;
};

function toDuplicationSourceFiles(
  files: RepositoryFile[],
  getFormatByFile: (path: string) => string | undefined
): DuplicationSourceFile[] {
  const sourceFiles: DuplicationSourceFile[] = [];

  for (const file of files) {
    const format = getFormatByFile(file.path);
    if (format === undefined) continue;

    sourceFiles.push({
      ...file,
      format,
    });
  }

  return sourceFiles;
}

export async function calculateRepositoryDuplication(
  files: RepositoryFile[]
): Promise<DuplicationReport> {
  const validFiles = files.filter(
    (file) => !ProjectPolicy.isTestFile(file.path) && !ProjectPolicy.isConfigFile(file.path)
  );

  const fallbackReport: DuplicationReport = {
    clones: [],
    duplicationPercentage: 0,
    totalDuplicatedLines: 0,
  };

  if (validFiles.length === 0) return fallbackReport;

  const options: IOptions = {
    absolute: false,
    exitCode: 0,
    ignorePattern: [...PROJECT_POLICY_RULES.duplicatesIgnorePattern],
    minLines: 7,
    minTokens: 55,
    reporters: [],
  };
  let closeStore: (() => void) | undefined;

  try {
    const [{ Detector, MemoryStore }, { getFormatByFile, Tokenizer }] = await Promise.all([
      import("@jscpd/core"),
      import("@jscpd/tokenizer"),
    ]);
    const sourceFiles = toDuplicationSourceFiles(validFiles, getFormatByFile);
    if (sourceFiles.length === 0) return fallbackReport;

    const tokenizer = new Tokenizer();
    const store = new MemoryStore<IMapFrame>();
    closeStore = () => store.close();
    const detector = new Detector(tokenizer, store, undefined, options);
    const clones: IClone[] = [];

    for (const file of sourceFiles) {
      clones.push(...(await detector.detect(file.path, file.content, file.format)));
    }

    let totalLinesInValidFiles = 0;
    for (const file of sourceFiles) {
      totalLinesInValidFiles += file.content.split(/\r?\n/u).length;
    }

    let totalDuplicatedLines = 0;

    const clonesMap = clones.map((clone) => {
      const linesCount = clone.duplicationA.end.line - clone.duplicationA.start.line + 1;
      totalDuplicatedLines += linesCount;

      const fragment = clone.duplicationA.fragment ?? "";
      const linesArray = fragment.split("\n");
      const fragmentPreview =
        linesArray.slice(0, 5).join("\n") + (linesArray.length > 5 ? "\n..." : "");

      return {
        fragmentPreview,
        lines: linesCount,
        primary: {
          endLine: clone.duplicationA.end.line,
          path: clone.duplicationA.sourceId,
          startLine: clone.duplicationA.start.line,
        },
        secondary: {
          endLine: clone.duplicationB.end.line,
          path: clone.duplicationB.sourceId,
          startLine: clone.duplicationB.start.line,
        },
      };
    });

    const calculatedPercentage =
      totalLinesInValidFiles > 0 ? (totalDuplicatedLines / totalLinesInValidFiles) * 100 : 0;

    const roundedPercentage = Math.round(calculatedPercentage * 10) / 10;

    return {
      clones: clonesMap,
      duplicationPercentage: clamp(roundedPercentage, 0, 100),
      totalDuplicatedLines,
    };
  } catch {
    return fallbackReport;
  } finally {
    closeStore?.();
  }
}
