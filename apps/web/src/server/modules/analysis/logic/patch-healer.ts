import { normalize } from "pathe";

import type { PRFinding } from "./pr.types";
import { lineSimilarity } from "./surgical-edit";

const HUNK_HEADER_PATTERN = /@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
const FUZZY_HEAL_THRESHOLD = 0.75;

type PatchScan = {
  commentable: Set<number>;
  lineMap: Map<string, number>;
};

/**
 * Single pass over a unified diff collecting both things the reviewer needs:
 * the new-file line numbers GitHub accepts inline comments on (context and added
 * lines only), and a `trimmed added line -> line number` lookup used to repair
 * hallucinated finding lines.
 *
 * Removed lines are never commentable and never advance the cursor, because they
 * do not exist in the new file.
 */
function scanPatch(patch: string): PatchScan {
  const commentable = new Set<number>();
  const lineMap = new Map<string, number>();
  if (!patch) {
    return { commentable, lineMap };
  }

  const lines = patch.split("\n");
  let currentNewFileLine = 0;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      const match = HUNK_HEADER_PATTERN.exec(line);
      if (match?.[1] != null) {
        currentNewFileLine = Number.parseInt(match[1], 10);
      }
      continue;
    }

    if (currentNewFileLine === 0 || line.startsWith("\\")) {
      continue;
    }

    if (line.startsWith("+")) {
      if (line.startsWith("+++")) {
        continue;
      }
      commentable.add(currentNewFileLine);
      const cleanText = line.slice(1).trim();
      if (cleanText.length > 0) {
        lineMap.set(cleanText, currentNewFileLine);
      }
      currentNewFileLine++;
    } else if (line.startsWith("-")) {
      if (line.startsWith("---")) {
        continue;
      }
    } else {
      commentable.add(currentNewFileLine);
      currentNewFileLine++;
    }
  }

  return { commentable, lineMap };
}

export function getCommentableLinesFromPatch(patch: string): Set<number> {
  return scanPatch(patch).commentable;
}

export function buildLineMappingFromPatch(patch: string): Map<string, number> {
  return scanPatch(patch).lineMap;
}

/**
 * Recovers the real line number of a finding whose LLM-reported `line` drifted.
 * Tries, in order: exact snippet match, bidirectional substring match, then a
 * fuzzy match above `FUZZY_HEAL_THRESHOLD`. Falls back to the reported line.
 */
export function healFindingLine(
  lineMap: Map<string, number>,
  codeSnippet: string,
  hallucinatedLine: number,
): number {
  const snippetLines = codeSnippet
    .split("\n")
    .map((l) => l.replace(/^[+-]/, "").trim())
    .filter(Boolean);

  for (const snippetLine of snippetLines) {
    const exact = lineMap.get(snippetLine);
    if (exact != null) {
      return exact;
    }

    for (const [mapText, mapLine] of lineMap.entries()) {
      if (mapText.includes(snippetLine) || snippetLine.includes(mapText)) {
        return mapLine;
      }
    }

    let bestScore = 0;
    let bestLine = hallucinatedLine;
    for (const [mapText, mapLine] of lineMap.entries()) {
      const score = lineSimilarity(snippetLine, mapText);
      if (score > bestScore && score > FUZZY_HEAL_THRESHOLD) {
        bestScore = score;
        bestLine = mapLine;
      }
    }
    if (bestScore > 0) {
      return bestLine;
    }
  }

  return hallucinatedLine;
}

export type PatchHealResult = {
  commentable: PRFinding[];
  findings: PRFinding[];
};

/**
 * Corrects every finding's line number against its file patch and splits the
 * findings into those GitHub will accept inline and those it will not.
 *
 * Findings are corrected in place, so the returned `findings` array and the
 * caller's input array are the same objects: downstream code that re-reads the
 * original list sees the repaired line numbers.
 */
export function healAndPartitionFindings(params: {
  changedFiles: ReadonlyArray<{ filename: string; patch?: null | string }>;
  findings: PRFinding[];
}): PatchHealResult {
  const { changedFiles, findings } = params;

  const lineMaps = new Map<string, Map<string, number>>();
  const commentableLines = new Map<string, Set<number>>();

  for (const file of changedFiles) {
    if (file.patch != null) {
      const normName = normalize(file.filename);
      const { commentable: lines, lineMap } = scanPatch(file.patch);
      lineMaps.set(normName, lineMap);
      commentableLines.set(normName, lines);
    }
  }

  const commentable: PRFinding[] = [];

  for (const finding of findings) {
    const normPath = normalize(finding.file);
    const lineMap = lineMaps.get(normPath);
    const fileCommentable = commentableLines.get(normPath);

    const correctedLine =
      lineMap != null && finding.codeSnippet != null
        ? healFindingLine(lineMap, finding.codeSnippet, finding.line)
        : finding.line;

    finding.line = correctedLine;

    if (fileCommentable?.has(correctedLine)) {
      commentable.push(finding);
    }
  }

  return { commentable, findings };
}
