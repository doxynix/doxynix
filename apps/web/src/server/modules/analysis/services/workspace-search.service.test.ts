import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

import { analysisRepo } from "../analysis.repository";
import { MAX_SEARCHABLE_DOCUMENT_FETCH } from "../analysis.utils";
import { analysisRepoRouter } from "../analysis-repo.router";
import { workspaceSearchService } from "./workspace-search.service";

const REPO_ID = "0195f000-0000-7000-8000-000000000002";

function makeCtx() {
  return {
    db: {} as unknown as DbClient,
    prisma: {},
    redis: {},
    req: { headers: new Headers() } as never,
    requestInfo: { requestId: "req-test" },
    session: { session: {}, user: { id: "user-1", role: "USER" } },
  };
}

describe("analysisRepo.loadLatestDocumentsWithContent", () => {
  it("never requests more than the per-type document cap", async () => {
    const findMany = vi.fn<(args: { take?: number }) => Promise<never[]>>(async () => []);
    const db = { document: { findMany } } as unknown as DbClient;

    await analysisRepo.loadLatestDocumentsWithContent(db, REPO_ID);

    expect(findMany.mock.calls[0]?.[0]?.take).toBe(MAX_SEARCHABLE_DOCUMENT_FETCH);
  });

  it("orders the capped fetch by type first so every type survives the cap", async () => {
    const findMany = vi.fn<(args: { orderBy?: unknown }) => Promise<never[]>>(async () => []);
    const db = { document: { findMany } } as unknown as DbClient;

    await analysisRepo.loadLatestDocumentsWithContent(db, REPO_ID);

    // Documents are versioned, so a cap ordered by recency alone can be filled
    // entirely by one type and starve the rest of the DocType enum.
    const orderBy = findMany.mock.calls[0]?.[0]?.orderBy as
      | Array<Record<string, string>>
      | Record<string, string>
      | undefined;
    const keys = Array.isArray(orderBy)
      ? orderBy.map((entry) => Object.keys(entry)[0])
      : orderBy == null
        ? []
        : [Object.keys(orderBy)[0]];

    expect(keys).toEqual(["type", "updatedAt"]);
  });
});

describe("workspaceSearchService.search", () => {
  it("returns nothing when the repo snapshot is missing", async () => {
    const db = { repo: { findUnique: async () => null } } as unknown as DbClient;

    await expect(workspaceSearchService.search(db, REPO_ID, "controller")).resolves.toEqual([]);
  });
});

describe("analysisRepoRouter.searchWorkspace", () => {
  it("rejects a single-character query at the router boundary", async () => {
    const { createCallerFactory, createTRPCRouter } = await import("@/server/core/trpc/init");
    const caller = createCallerFactory(createTRPCRouter(analysisRepoRouter))(makeCtx() as never);

    // Asserted on the code, not just "throws": an empty `db` would reject with a
    // TypeError and make this pass even without input validation.
    await expect(caller.searchWorkspace({ repoId: REPO_ID, search: "a" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
