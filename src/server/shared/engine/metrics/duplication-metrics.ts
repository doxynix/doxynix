import type { RepositoryFile } from "../core/discovery.types";
import { ProjectPolicy } from "../core/project-policy";

export function calculateApproximateDuplication(files: RepositoryFile[]): number {
  const hashes = new Set<string>();
  let duplicatedLines = 0;

  for (const file of files) {
    if (ProjectPolicy.isTestFile(file.path) || ProjectPolicy.isConfigFile(file.path)) continue;

    const cleanLines = file.content
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(
        (line) =>
          line.length > 5 && !line.startsWith("/") && !line.startsWith("*") && !line.startsWith("#")
      );

    const WINDOW_SIZE = 6;
    for (let i = 0; i <= cleanLines.length - WINDOW_SIZE; i++) {
      const block = cleanLines
        .slice(i, i + WINDOW_SIZE)
        .join("|")
        .toLowerCase();

      const hash = Buffer.from(block).toString("base64");

      if (hashes.has(hash)) {
        duplicatedLines += WINDOW_SIZE;
        i += WINDOW_SIZE - 1;
      } else {
        hashes.add(hash);
      }
    }
  }

  return duplicatedLines;
}
