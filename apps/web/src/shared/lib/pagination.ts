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

// Windowing: <= 7 pages renders every number; otherwise pages more than one step from the current (excluding first/last) collapse into a single ellipsis exactly two steps away. `key` is the page index, preserving the original reconciliation keys.
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
