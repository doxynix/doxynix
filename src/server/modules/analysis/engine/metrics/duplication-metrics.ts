import type { IClone, IOptions } from "@jscpd/core";
import { clamp } from "es-toolkit";
import { detectClones } from "jscpd";

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
    list: validFiles.map((file) => ({
      name: file.path,
      source: file.content,
    })) as any,
    minLines: 7,
    minTokens: 55,
    reporters: [],
  };

  try {
    const clones: IClone[] = await detectClones(options);

    let totalLinesInValidFiles = 0;
    for (const file of validFiles) {
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
  }
}
