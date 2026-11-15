import { describe, expect, it } from "vitest";

import {
  decidePrepend,
  FIRST_ITEM_INDEX_START,
  resetHistoryWindow,
  seedHistoryWindow,
} from "./history-window";

function page(...ids: string[]) {
  return { items: ids.map((id) => ({ id })) };
}

function ids(result: { items: { id: string }[] }) {
  return result.items.map((item) => item.id);
}

const newestPage = page("n1", "n2");
const olderPage = page("o1", "o2");
const oldestPage = page("a1", "a2");

describe("resetHistoryWindow", () => {
  it("starts a fresh session unseeded, so nothing can prepend before page 0", () => {
    const fresh = resetHistoryWindow();

    expect(fresh).toStrictEqual({ firstItemIndex: FIRST_ITEM_INDEX_START, loadedPages: null });
    expect(decidePrepend(fresh, []).items).toStrictEqual([]);
  });
});

describe("seedHistoryWindow", () => {
  it("counts page 0 without touching the index or any messages", () => {
    expect(seedHistoryWindow(resetHistoryWindow(), true)).toStrictEqual({
      firstItemIndex: FIRST_ITEM_INDEX_START,
      loadedPages: 1,
    });
  });

  it("stays unseeded while page 0 is missing", () => {
    expect(seedHistoryWindow(resetHistoryWindow(), false)).toStrictEqual({
      firstItemIndex: FIRST_ITEM_INDEX_START,
      loadedPages: null,
    });
  });

  it("never raises the index under already-prepended pages", () => {
    const prepended = decidePrepend(resetHistoryWindow(), [newestPage, olderPage]).window;

    expect(seedHistoryWindow(prepended, true)).toBe(prepended);
  });
});

describe("decidePrepend", () => {
  it("prepends two older pages oldest-first", () => {
    const result = decidePrepend(resetHistoryWindow(), [newestPage, olderPage, oldestPage]);

    expect(ids(result)).toStrictEqual(["a1", "a2", "o1", "o2"]);
    expect(result.window).toStrictEqual({
      firstItemIndex: FIRST_ITEM_INDEX_START - 4,
      loadedPages: 3,
    });
  });

  it("prepends nothing when only page 0 exists (a chat created in this mount)", () => {
    expect(decidePrepend(resetHistoryWindow(), [newestPage])).toStrictEqual({
      items: [],
      window: seedHistoryWindow(resetHistoryWindow(), true),
    });
  });

  it("prepends nothing when a refetch returns the same page count", () => {
    const loaded = decidePrepend(resetHistoryWindow(), [newestPage, olderPage]).window;

    const result = decidePrepend(loaded, [newestPage, olderPage]);

    expect(result.items).toStrictEqual([]);
    expect(result.window).toBe(loaded);
  });

  it("leaves a same-session re-click untouched: no reset, no index change", () => {
    const seeded = decidePrepend(resetHistoryWindow(), [newestPage, olderPage]).window;

    expect(decidePrepend(seeded, [newestPage, olderPage]).window).toBe(seeded);
  });

  it("only reports pages added since the last merge", () => {
    const loaded = decidePrepend(resetHistoryWindow(), [newestPage, olderPage]).window;

    expect(ids(decidePrepend(loaded, [newestPage, olderPage, oldestPage]))).toStrictEqual([
      "a1",
      "a2",
    ]);
  });
});
