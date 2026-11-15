export type CursorPage<TItem> = {
  items: TItem[];
  meta: { hasNextPage: boolean; nextCursor?: string };
};

export type CursorPagesSummary<TItem> = CursorPage<TItem> & { total: number };

/**
 * Folds a walked cursor list back into one page. Only the first server page counts rows, so the
 * first non-null `total` is the walk's; later pages answer `null` for it.
 */
export function summarizeCursorPages<TPage extends CursorPage<unknown> & { total: null | number }>(
  pages: TPage[],
): CursorPagesSummary<TPage["items"][number]> {
  const last = pages.at(-1);

  return {
    items: pages.flatMap((page) => page.items),
    meta: { hasNextPage: last?.meta.hasNextPage ?? false, nextCursor: last?.meta.nextCursor },
    total: pages.find((page) => page.total != null)?.total ?? 0,
  };
}

export const MAX_CURSOR_PAGES = 10;

export async function collectCursorPages<TItem>(
  fetchPage: (cursor: string | undefined) => Promise<CursorPage<TItem>>,
  maxPages = MAX_CURSOR_PAGES,
): Promise<TItem[]> {
  const items: TItem[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const result = await fetchPage(cursor);
    items.push(...result.items);

    if (result.meta.nextCursor == null) {
      return items;
    }

    cursor = result.meta.nextCursor;
  }

  return items;
}
