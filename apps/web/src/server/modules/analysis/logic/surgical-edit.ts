export function getIndent(line: string): string {
  const match = /^\s*/.exec(line);
  return match ? match[0] : "";
}

export function adjustIndentation(
  replaceLines: string[],
  searchIndent: string,
  targetIndent: string,
): string[] {
  if (searchIndent === targetIndent) {
    return replaceLines;
  }

  return replaceLines.map((line) => {
    if (line.trim() === "") {
      return "";
    }

    if (line.startsWith(searchIndent)) {
      return targetIndent + line.slice(searchIndent.length);
    }
    return targetIndent + line.trimStart();
  });
}

export function getTokens(line: string): string[] {
  return line
    .trim()
    .toLowerCase()
    .split(/[\s()[\]{}.,;+\-*/=<>!]+/gu)
    .filter(Boolean);
}

export function lineSimilarity(line1: string, line2: string): number {
  const t1 = getTokens(line1);
  const t2 = getTokens(line2);
  if (t1.length === 0 && t2.length === 0) {
    return 1.0;
  }
  if (t1.length === 0 || t2.length === 0) {
    return 0.0;
  }

  const set1 = new Set(t1);
  const set2 = new Set(t2);
  let intersection = 0;
  for (const token of set1) {
    if (set2.has(token)) {
      intersection++;
    }
  }
  const union = set1.size + set2.size - intersection;
  return intersection / union;
}

export type SurgicalEditResult = {
  content: string;
  kind: "exact" | "indent" | "fuzzy" | "none";
  similarity: number;
};

export function applySurgicalEditBlock(params: {
  fileContent: string;
  replaceBlock: string;
  searchBlock: string;
}): SurgicalEditResult {
  const { fileContent, replaceBlock, searchBlock } = params;

  if (fileContent.includes(searchBlock)) {
    return {
      content: fileContent.replace(searchBlock, replaceBlock),
      kind: "exact",
      similarity: 1,
    };
  }

  const searchLines = searchBlock.split("\n");
  const fileLines = fileContent.split("\n");

  let matchedIndex = -1;
  let matchedIndent = "";
  let originalSearchIndent = "";

  const firstNonEmptySearchLine = searchLines.find((l) => l.trim() !== "") ?? "";
  originalSearchIndent = getIndent(firstNonEmptySearchLine);

  for (let i = 0; i <= fileLines.length - searchLines.length; i++) {
    let isMatch = true;
    let detectedIndent: string | null = null;

    for (let j = 0; j < searchLines.length; j++) {
      const sLine = searchLines[j] ?? "";
      const fLine = fileLines[i + j] ?? "";

      if (sLine.trim() === "" && fLine.trim() === "") {
        continue;
      }

      if (sLine.trim() === "" || fLine.trim() === "") {
        isMatch = false;
        break;
      }

      if (sLine.trim() !== fLine.trim()) {
        isMatch = false;
        break;
      }

      if (detectedIndent === null && fLine.trim() !== "") {
        detectedIndent = getIndent(fLine);
      }
    }

    if (isMatch) {
      matchedIndex = i;
      matchedIndent = detectedIndent ?? "";
      break;
    }
  }

  if (matchedIndex !== -1) {
    const adjustedReplaceLines = adjustIndentation(
      replaceBlock.split("\n"),
      originalSearchIndent,
      matchedIndent,
    );

    fileLines.splice(matchedIndex, searchLines.length, ...adjustedReplaceLines);
    return { content: fileLines.join("\n"), kind: "indent", similarity: 1 };
  }

  let bestIndex = -1;
  let bestScore = 0;
  let bestWindowIndent = "";

  for (let i = 0; i <= fileLines.length - searchLines.length; i++) {
    let totalScore = 0;
    let detectedIndent: string | null = null;

    for (let j = 0; j < searchLines.length; j++) {
      const sLine = searchLines[j] ?? "";
      const fLine = fileLines[i + j] ?? "";

      if (sLine.trim() === "" && fLine.trim() === "") {
        totalScore += 1.0;
        continue;
      }

      totalScore += lineSimilarity(sLine, fLine);

      if (detectedIndent === null && fLine.trim() !== "") {
        detectedIndent = getIndent(fLine);
      }
    }

    const avgScore = totalScore / searchLines.length;
    if (avgScore > bestScore && avgScore > 0.75) {
      bestScore = avgScore;
      bestIndex = i;
      bestWindowIndent = detectedIndent ?? "";
    }
  }

  if (bestIndex !== -1) {
    const adjustedReplaceLines = adjustIndentation(
      replaceBlock.split("\n"),
      originalSearchIndent,
      bestWindowIndent,
    );

    fileLines.splice(bestIndex, searchLines.length, ...adjustedReplaceLines);
    return { content: fileLines.join("\n"), kind: "fuzzy", similarity: bestScore };
  }

  return { content: fileContent, kind: "none", similarity: 0 };
}
