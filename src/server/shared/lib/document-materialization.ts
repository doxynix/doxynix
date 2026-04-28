import type { DocType } from "@prisma/client";
import { join, normalize } from "pathe";

import { normalizeRepoPath } from "@/server/shared/engine/core/common";

const DOC_ROOT_PATH = "docs";
const CODE_DOC_ROOT_PATH = join(DOC_ROOT_PATH, "code");

export function resolveDocumentMaterializedPath(params: {
  sourcePath: null | string | undefined;
  type: DocType;
}) {
  if (params.type === "README") return "README.md";
  if (params.type === "CONTRIBUTING") return "CONTRIBUTING.md";
  if (params.type === "CHANGELOG") return "CHANGELOG.md";
  if (params.type === "API") return join(DOC_ROOT_PATH, "API.md");
  if (params.type === "ARCHITECTURE") return join(DOC_ROOT_PATH, "ARCHITECTURE.md");

  const sourcePath = params.sourcePath?.trim();
  if (sourcePath == null || sourcePath.length === 0) {
    throw new Error("CODE_DOC requires source path for materialization");
  }

  const normalizedSourcePath = normalizeRepoPath(sourcePath);
  return normalize(join(CODE_DOC_ROOT_PATH, `${normalizedSourcePath}.md`));
}
