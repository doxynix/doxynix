import { appLogger } from "@/server/core/app-logger";

import { applySurgicalEditBlock } from "./surgical-edit";

/**
 * Applies one AI-proposed documentation edit to a file, tolerating imperfect
 * whitespace: the block is matched exactly, by indentation, or fuzzily, and a
 * failed match leaves the file untouched instead of corrupting it.
 */
export function applyDocumentSurgicalEdit(params: {
  filePath: string;
  original: string;
  replace: string;
  search: string;
}): string {
  const { filePath, original, replace, search } = params;

  const { content, kind, similarity } = applySurgicalEditBlock({
    fileContent: original.replaceAll("\r\n", "\n"),
    replaceBlock: replace.replaceAll("\r\n", "\n"),
    searchBlock: search.replaceAll("\r\n", "\n"),
  });

  if (kind === "fuzzy") {
    appLogger.info({
      filePath,
      msg: `Fuzzy documenter match applied (similarity: ${Math.round(similarity * 100)}%)`,
    });
  } else if (kind === "none") {
    appLogger.error({
      filePath,
      msg: "Documenter surgical block match failed. Original code block not found.",
      searchLength: search.length,
    });
  }

  return content;
}
