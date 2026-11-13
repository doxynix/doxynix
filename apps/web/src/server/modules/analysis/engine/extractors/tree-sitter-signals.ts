import { appLogger } from "@/server/core/app-logger";
import { getSpecByExt } from "@/server/core/tree-sitter";
import { getFileExtension } from "@/server/utils/path-operations";

import type { FileSignals, RepositoryFile } from "../core/discovery.types";
import { QUERY_SPECS } from "./queries";
import { collectQuerySignals } from "./query-signals";

export async function collectTreeSitterSignals(file: RepositoryFile): Promise<FileSignals | null> {
  const ext = getFileExtension(file.path);
  const spec = getSpecByExt(ext);
  const querySpec = QUERY_SPECS[ext];
  if (spec == null || querySpec == null) {
    return null;
  }

  try {
    return await collectQuerySignals(file, ext, querySpec);
  } catch (error) {
    appLogger.error({ error, ext, msg: "Tree-sitter query extraction failed", path: file.path });
    return null;
  }
}
