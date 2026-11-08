import type { FileTuple } from "@/entities/repo/model/repo-setup.types";

export function resolveSelectedFiles(files: FileTuple[] | undefined, selectedIds: Set<string>) {
  if (files == null) {
    return [];
  }

  const leafFilePaths = new Set(files.filter((file) => file[1] === 1).map((file) => file[0]));

  return Array.from(selectedIds).filter((id) => leafFilePaths.has(id));
}
