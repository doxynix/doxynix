import type { RepositoryFile } from "../core/types";
import { regexAdapter } from "./regex.adapter";
import { treeSitterAdapter } from "./tree-sitter.adapter";
import { matchesExtension, type LanguageAdapter } from "./types";
import { typeScriptAdapter } from "./typescript.adapter";

const REGISTRY: LanguageAdapter[] = [typeScriptAdapter, treeSitterAdapter, regexAdapter].sort(
  (left, right) => right.priority - left.priority
);

export function getLanguageAdapters(file: RepositoryFile) {
  return REGISTRY.filter((adapter) => {
    if (!matchesExtension(adapter, file.path)) return false;
    return adapter.detect?.(file) ?? true;
  });
}

export function getLanguageAdapterRegistry() {
  return [...REGISTRY];
}
