import type { Tree } from "web-tree-sitter";

import {
  getParserForExt,
  getSpecByExt,
  loadLanguage,
  parseSource,
} from "@/server/core/tree-sitter";
import { compileQuery } from "@/server/core/tree-sitter/query-cache";
import { getFileExtension } from "@/server/utils/path-operations";

import type { RepositoryFile, SecurityFindingMetric } from "../core/discovery.types";
import { capturesByName, firstCapture } from "./queries/captures";
import { SECURITY_QUERY_SPECS } from "./security-query-specs";

export async function collectAstSecurityFindings(
  file: RepositoryFile,
): Promise<SecurityFindingMetric[]> {
  const ext = getFileExtension(file.path);
  const spec = getSpecByExt(ext);
  const querySource = SECURITY_QUERY_SPECS[ext];
  if (spec == null || querySource == null) {
    return [];
  }

  const parser = await getParserForExt(ext);
  const language = await loadLanguage(ext, spec);
  parser.setLanguage(language);

  let tree: Tree | undefined;

  try {
    tree = parseSource(parser, file.content) ?? undefined;
    if (tree == null) {
      return [];
    }
    const query = await compileQuery(ext, spec, querySource);
    const findings: SecurityFindingMetric[] = [];
    const seen = new Set<number>();

    for (const match of query.matches(tree.rootNode)) {
      const captures = capturesByName(match.captures);
      const sink =
        firstCapture(captures, "sink.name") ??
        firstCapture(captures, "sink.method") ??
        firstCapture(captures, "sink.property") ??
        firstCapture(captures, "sink.attr");
      if (sink == null) {
        continue;
      }

      const line = sink.startPosition.row + 1;
      if (seen.has(line)) {
        continue;
      }
      seen.add(line);

      findings.push({
        line,
        message: `AST sink detected: ${sink.text}`,
        path: file.path,
        severity: "warning",
      });
    }

    return findings;
  } finally {
    tree?.delete();
  }
}
