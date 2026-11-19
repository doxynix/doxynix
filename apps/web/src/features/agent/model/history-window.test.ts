import { describe, expect, it } from "vitest";

import {
  decidePrepend,
  FIRST_ITEM_INDEX_START,
  filterNewMessages,
  resetHistoryWindow,
  seedHistoryWindow,
} from "./history-window";

function page(...ids: string[]) {
  return { items: ids.map((id) => ({ id })) };
}

function ids(result: { items: { id: string }[] }) {
  return result.items.map((item) => item.id);
}

function itemIds(items: readonly { id: string }[]) {
  return items.map((item) => item.id);
}

const noIds = new Set<string>();

const newestPage = page("n1", "n2");
const olderPage = page("o1", "o2");
const oldestPage = page("a1", "a2");

describe("filterNewMessages", () => {
  it("keeps every item when the transcript is empty", () => {
    expect(itemIds(filterNewMessages(olderPage.items, noIds))).toStrictEqual(["o1", "o2"]);
  });

  it("returns nothing for an empty page", () => {
    expect(filterNewMessages([], new Set(["o1"]))).toStrictEqual([]);
  });

  it("drops every item when they are all already rendered", () => {
    expect(filterNewMessages(olderPage.items, new Set(["o1", "o2"]))).toStrictEqual([]);
  });

  it("keeps only the unseen rows, in their original order", () => {
    expect(itemIds(filterNewMessages(olderPage.items, new Set(["o1"])))).toStrictEqual(["o2"]);
  });

  it("drops a row repeated inside the older pages", () => {
    expect(itemIds(filterNewMessages(page("o1", "o2", "o1").items, noIds))).toStrictEqual([
      "o1",
      "o2",
    ]);
  });
});

describe("resetHistoryWindow", () => {
  it("starts a fresh session unseeded, so nothing can prepend before page 0", () => {
    const fresh = resetHistoryWindow();

    expect(fresh).toStrictEqual({ firstItemIndex: FIRST_ITEM_INDEX_START, loadedPages: null });
    expect(decidePrepend(fresh, [], noIds).items).toStrictEqual([]);
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
    const prepended = decidePrepend(resetHistoryWindow(), [newestPage, olderPage], noIds).window;

    expect(seedHistoryWindow(prepended, true)).toBe(prepended);
  });
});

describe("decidePrepend", () => {
  it("prepends two older pages oldest-first", () => {
    const result = decidePrepend(resetHistoryWindow(), [newestPage, olderPage, oldestPage], noIds);

    expect(ids(result)).toStrictEqual(["a1", "a2", "o1", "o2"]);
    expect(result.window).toStrictEqual({
      firstItemIndex: FIRST_ITEM_INDEX_START - 4,
      loadedPages: 3,
    });
  });

  it("prepends nothing when only page 0 exists (a chat created in this mount)", () => {
    expect(decidePrepend(resetHistoryWindow(), [newestPage], noIds)).toStrictEqual({
      items: [],
      window: seedHistoryWindow(resetHistoryWindow(), true),
    });
  });

  it("prepends nothing when a refetch returns the same page count", () => {
    const loaded = decidePrepend(resetHistoryWindow(), [newestPage, olderPage], noIds).window;

    const result = decidePrepend(loaded, [newestPage, olderPage], noIds);

    expect(result.items).toStrictEqual([]);
    expect(result.window).toBe(loaded);
  });

  it("leaves a same-session re-click untouched: no reset, no index change", () => {
    const seeded = decidePrepend(resetHistoryWindow(), [newestPage, olderPage], noIds).window;

    expect(decidePrepend(seeded, [newestPage, olderPage], noIds).window).toBe(seeded);
  });

  it("only reports pages added since the last merge", () => {
    const loaded = decidePrepend(resetHistoryWindow(), [newestPage, olderPage], noIds).window;

    expect(ids(decidePrepend(loaded, [newestPage, olderPage, oldestPage], noIds))).toStrictEqual([
      "a1",
      "a2",
    ]);
  });

  it("advances the page count without shifting the index when every older row is rendered", () => {
    const loaded = decidePrepend(resetHistoryWindow(), [newestPage, olderPage], noIds).window;

    const result = decidePrepend(
      loaded,
      [newestPage, olderPage, page("o1", "o2")],
      new Set(["n1", "n2", "o1", "o2"]),
    );

    expect(result.items).toStrictEqual([]);
    expect(result.window).toStrictEqual({
      firstItemIndex: loaded.firstItemIndex,
      loadedPages: 3,
    });
  });
});
