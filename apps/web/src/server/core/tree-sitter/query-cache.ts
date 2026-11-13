import { Query } from "web-tree-sitter";

import { type LanguageSpec, loadLanguage } from "./index";

const cache = new Map<string, Promise<Query>>();

export async function compileQuery(
  ext: string,
  spec: LanguageSpec,
  source: string,
): Promise<Query> {
  const key = `${ext}\u0000${source}`;
  const cached = cache.get(key);
  if (cached != null) {
    return cached;
  }

  const compiled = (async () => {
    const language = await loadLanguage(ext, spec);
    return new Query(language, source);
  })().catch((error: unknown) => {
    cache.delete(key);
    throw error;
  });

  cache.set(key, compiled);
  return compiled;
}

// The cache owns every `Query`: callers must never `delete()` one, and a handle is invalid
// the moment `disposeQueries()` runs, even if a caller is still holding the reference.
export function disposeQueries(): void {
  for (const queryPromise of cache.values()) {
    queryPromise.then((query) => query.delete()).catch(() => undefined);
  }
  cache.clear();
}
