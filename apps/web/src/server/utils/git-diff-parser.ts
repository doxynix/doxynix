export type GitDiffAddedLine = {
  content: string;
  lineAfter: number;
};

const HUNK_HEADER_REGEX = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function extractAddedLinesFromPatch(patch: string): GitDiffAddedLine[] {
  if (typeof patch !== "string" || patch.length === 0) {
    return [];
  }

  const lines = patch.split(/\r?\n/u);
  const addedLines: GitDiffAddedLine[] = [];

  let currentLineAfter = 0;
  let inHunk = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line != null && (line.startsWith("---") || line.startsWith("+++"))) {
      inHunk = false;
      continue;
    }
    if (line != null) {
      const hunkMatch = HUNK_HEADER_REGEX.exec(line);
      if (hunkMatch != null) {
        currentLineAfter = Number.parseInt(hunkMatch[1] ?? "1", 10);
        inHunk = true;
        continue;
      }
    }

    if (!inHunk) {
      continue;
    }

    if (line?.startsWith("+")) {
      addedLines.push({
        content: line.slice(1),
        lineAfter: currentLineAfter,
      });
      currentLineAfter++;
    } else if (line?.startsWith("-")) {
      // Deleting a line does not increment the line number in the new file
    } else if (line?.startsWith("\\")) {
      // Ignore the metastring “\ No newline at end of file”"
    } else {
      // Contextual string (unchanged)
      currentLineAfter++;
    }
  }

  return addedLines;
}
