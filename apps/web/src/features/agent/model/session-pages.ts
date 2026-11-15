type Page<TItem> = { items: readonly TItem[] };

// `listSessions` keysets on `updatedAt`, which a rename or a new message moves, so a row can repeat
// across pages; the first occurrence wins to keep order and React keys stable.
export function flattenSessionPages<TItem extends { id: string }>(
  pages: readonly Page<TItem>[],
): TItem[] {
  const seen = new Set<string>();

  return pages
    .flatMap((page) => page.items)
    .filter((session) => {
      if (seen.has(session.id)) {
        return false;
      }

      seen.add(session.id);
      return true;
    });
}
