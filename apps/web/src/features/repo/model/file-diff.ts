import { structuredPatch } from "diff";

export type FileDiffRow =
  | { kind: "hunk"; header: string }
  | {
      content: string;
      kind: "add" | "context" | "remove";
      newLine: number | null;
      oldLine: number | null;
    };

export type FileDiff = {
  additions: number;
  deletions: number;
  rows: FileDiffRow[];
};

export function buildFileDiff(oldText: string, newText: string): FileDiff {
  const patch = structuredPatch("original", "modified", oldText, newText, "", "", {
    context: 3,
    stripTrailingCr: true,
  });

  const rows: FileDiffRow[] = [];
  let additions = 0;
  let deletions = 0;

  for (const hunk of patch.hunks) {
    rows.push({
      header: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
      kind: "hunk",
    });

    let oldLine = hunk.oldStart;
    let newLine = hunk.newStart;

    for (const line of hunk.lines) {
      const marker = line.charAt(0);
      const content = line.slice(1);

      if (marker === "+") {
        rows.push({ content, kind: "add", newLine, oldLine: null });
        additions++;
        newLine++;
      } else if (marker === "-") {
        rows.push({ content, kind: "remove", newLine: null, oldLine });
        deletions++;
        oldLine++;
      } else if (marker === " ") {
        rows.push({ content, kind: "context", newLine, oldLine });
        oldLine++;
        newLine++;
      }
    }
  }

  return { additions, deletions, rows };
}
