const SEARCH_TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;
const MAX_SEARCH_TERMS = 8;
const MIN_SEARCH_TERM_LENGTH = 2;

export function normalizeSearchInput(search?: string): string | undefined {
  const normalized = search?.trim().toLowerCase();

  return normalized != null && normalized.length > 0 ? normalized : undefined;
}

export function tokenizeSearchInput(search?: string): string[] {
  const normalizedSearch = normalizeSearchInput(search);
  if (normalizedSearch == null) return [];

  const matches = normalizedSearch.match(SEARCH_TOKEN_PATTERN) ?? [];
  const uniqueTerms = new Set<string>();

  for (const match of matches) {
    if (match.length < MIN_SEARCH_TERM_LENGTH) continue;

    uniqueTerms.add(match);
    if (uniqueTerms.size >= MAX_SEARCH_TERMS) break;
  }

  return [...uniqueTerms];
}
