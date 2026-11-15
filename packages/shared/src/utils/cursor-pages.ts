export type CursorPage<TItem> = {
  items: TItem[];
  meta: { hasNextPage: boolean; nextCursor?: string };
};

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
