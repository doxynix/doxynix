import { collectCursorPages, MAX_PAGE_SIZE } from "@doxynix/shared";

import { type RouterOutput, trpc } from "./client";

export type FixItem = RouterOutput["analysis"]["getByRepository"]["items"][number];

export async function fetchFixes(repoId: string): Promise<FixItem[]> {
  return collectCursorPages((cursor) =>
    trpc.analysis.getByRepository.query({ cursor, limit: MAX_PAGE_SIZE, repoId }),
  );
}
