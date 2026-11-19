import type { RepoSnapshot, RepoWithLatestAnalysisAndDocs } from "../analysis.repository";
import { createAnalyzeContextBuilder } from "./analyze-context-builder";

type AnalyzeContextBuilder = ReturnType<typeof createAnalyzeContextBuilder>;

const MAX_MEMOIZED_CONTEXTS = 32;

const contexts = new Map<string, AnalyzeContextBuilder>();

function memoKey(repo: RepoSnapshot | RepoWithLatestAnalysisAndDocs) {
  return `${repo.id}:${repo.analyses[0]?.id ?? "latest"}`;
}

// Only the per-keystroke search path uses this: the builder caches each `nodeId` it explains, so a
// node-context request would grow the map for the process lifetime.
export function getMemoizedAnalyzeContext(repo: RepoSnapshot | RepoWithLatestAnalysisAndDocs) {
  const key = memoKey(repo);
  const memoized = contexts.get(key);
  if (memoized != null) {
    return memoized;
  }

  const builder = createAnalyzeContextBuilder(repo);

  if (contexts.size >= MAX_MEMOIZED_CONTEXTS) {
    const oldestKey = contexts.keys().next().value;
    if (oldestKey != null) {
      contexts.delete(oldestKey);
    }
  }

  contexts.set(key, builder);
  return builder;
}

// Test-only: the map is process-wide, so one test must not inherit another's entries.
export function analyzeContextMemoSize() {
  return contexts.size;
}

export function resetAnalyzeContextMemo() {
  contexts.clear();
}
