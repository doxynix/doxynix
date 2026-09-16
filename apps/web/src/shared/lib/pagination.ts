export type PaginationItem =
  | {
      kind: "ellipsis";
      key: number;
    }
  | {
      key: number;
      kind: "page";
      page: number;
    };

/**
 * Computes the visible pagination items for a page-number bar.
 *
 * Mirrors the windowing rules previously inlined in `AppPagination`:
 * - `totalPages <= 7` renders every page number.
 * - Otherwise pages farther than one step away from the current page
 *   (excluding first/last) collapse into a single ellipsis marker placed
 *   exactly two steps away from the current page.
 *
 * `key` preserves the original per-item React key (the source loop index),
 * so swapping the inline `Array.from(...).map(...)` for this function does
 * not change reconciliation behavior.
 */
export function getPaginationItems(totalPages: number, currentPage: number): PaginationItem[] {
  const items: PaginationItem[] = [];

  for (let page = 1; page <= totalPages; page++) {
    if (totalPages > 7 && Math.abs(page - currentPage) > 1 && page !== 1 && page !== totalPages) {
      if (Math.abs(page - currentPage) === 2) {
        items.push({ key: page, kind: "ellipsis" });
      }
      continue;
    }

    items.push({ key: page, kind: "page", page });
  }

  return items;
}
