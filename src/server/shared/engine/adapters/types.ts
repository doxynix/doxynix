import path from "node:path";

import type { FileSignals, RepositoryFile } from "../core/discovery.types";

export type LanguageAdapter = {
  detect?: (file: RepositoryFile) => boolean;
  id: string;
  parse: (file: RepositoryFile) => FileSignals | null | Promise<FileSignals | null>;
  priority: number;
  supportedExtensions: string[];
};

export function matchesExtension(adapter: LanguageAdapter, filePath: string) {
  if (adapter.supportedExtensions.length === 0) return true;
  const ext = path.posix.extname(filePath).toLowerCase();
  return adapter.supportedExtensions.includes(ext);
}
