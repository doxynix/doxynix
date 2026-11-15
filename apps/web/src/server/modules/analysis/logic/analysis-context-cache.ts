import type { RepoSnapshot, RepoWithLatestAnalysisAndDocs } from "../analysis.repository";
import { createAnalyzeContextBuilder } from "./analyze-context-builder";

export type AnalyzeContextBuilder = ReturnType<typeof createAnalyzeContextBuilder>;

const MAX_CACHED_CONTEXTS = 32;

const contexts = new Map<string, AnalyzeContextBuilder>();

function cacheKey(repo: RepoSnapshot | RepoWithLatestAnalysisAndDocs) {
  return `${repo.id}:${repo.analyses[0]?.id ?? "latest"}`;
}

// An analysis row is immutable once `DONE`, so a re-run lands under a new id and never reuses this.
export function getCachedAnalyzeContext(repo: RepoSnapshot | RepoWithLatestAnalysisAndDocs) {
  const key = cacheKey(repo);
  const cached = contexts.get(key);
  if (cached != null) {
    return cached;
  }

  const builder = createAnalyzeContextBuilder(repo);

  if (contexts.size >= MAX_CACHED_CONTEXTS) {
    const oldestKey = contexts.keys().next().value;
    if (oldestKey != null) {
      contexts.delete(oldestKey);
    }
  }

  contexts.set(key, builder);
  return builder;
}
