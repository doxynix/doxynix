export const FIRST_ITEM_INDEX_START = 100_000;

export type HistoryWindow = {
  firstItemIndex: number;
  // Pages of the current session already reflected in the transcript; `null` before page 0.
  loadedPages: null | number;
};

type Page<TItem> = { items: readonly TItem[] };

export function resetHistoryWindow(): HistoryWindow {
  return { firstItemIndex: FIRST_ITEM_INDEX_START, loadedPages: null };
}

// Page 0 is the transcript's baseline, including a chat whose messages arrived from the stream.
// Only a session switch may raise `firstItemIndex`, and that happens through the reset above.
export function seedHistoryWindow(state: HistoryWindow, hasPageZero: boolean): HistoryWindow {
  if (!hasPageZero || state.loadedPages !== null) {
    return state;
  }

  return { ...state, loadedPages: 1 };
}

// A row can repeat inside `older` too: a refetch refills every page from a cursor that moved.
export function filterNewMessages<TItem extends { id: string }>(
  older: readonly TItem[],
  currentIds: ReadonlySet<string>,
): TItem[] {
  const seen = new Set(currentIds);

  return older.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

// Pages arrive newest-first and are oldest-first inside, so reversing the page order yields the
// items that belong above the ones already rendered.
export function decidePrepend<TItem extends { id: string }>(
  state: HistoryWindow,
  pages: readonly Page<TItem>[],
  currentIds: ReadonlySet<string>,
): { items: TItem[]; window: HistoryWindow } {
  const seeded = seedHistoryWindow(state, pages.length > 0);

  if (seeded.loadedPages === null || pages.length <= seeded.loadedPages) {
    return { items: [], window: seeded };
  }

  // A refetch refills every page, so a row can slide into a page below the one it was read from.
  const items = filterNewMessages(
    pages
      .slice(seeded.loadedPages)
      .toReversed()
      .flatMap((page) => page.items),
    currentIds,
  );

  return {
    items,
    window: { firstItemIndex: seeded.firstItemIndex - items.length, loadedPages: pages.length },
  };
}
