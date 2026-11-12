import type Parser from "web-tree-sitter";

import { type LanguageSpec, loadLanguage } from "./index";

const cache = new Map<string, Promise<Parser.Query>>();

export async function compileQuery(
  ext: string,
  spec: LanguageSpec,
  source: string,
): Promise<Parser.Query> {
  const key = `${ext}\u0000${source}`;
  const cached = cache.get(key);
  if (cached != null) {
    return cached;
  }

  const compiled = (async () => {
    const language = await loadLanguage(ext, spec);
    return language.query(source);
  })().catch((error: unknown) => {
    cache.delete(key);
    throw error;
  });

  cache.set(key, compiled);
  return compiled;
}

export function disposeQueries(): void {
  for (const queryPromise of cache.values()) {
    queryPromise.then((query) => query.delete()).catch(() => undefined);
  }
  cache.clear();
}
