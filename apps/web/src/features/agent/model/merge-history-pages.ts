type HistoryPage<TItem> = { items: readonly TItem[] };

// Pages arrive newest-first and are oldest-first inside, so reversing the page order yields the
// items that belong above the ones already rendered.
export function mergeOlderHistory<TItem>(
  pages: readonly HistoryPage<TItem>[],
  loadedCount: number,
): { addedCount: number; items: TItem[] } {
  const items = pages
    .slice(loadedCount)
    .toReversed()
    .flatMap((page) => page.items);

  return { addedCount: items.length, items };
}
