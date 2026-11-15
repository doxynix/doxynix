import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

import { analysisRepo } from "../analysis.repository";
import { MAX_SEARCHABLE_DOCUMENTS_PER_TYPE } from "../analysis.utils";
import { analysisRepoRouter } from "../analysis-repo.router";
import { workspaceSearchService } from "./workspace-search.service";

vi.mock("@/server/core/workspaces/resolve-workspace", () => ({
  resolveWorkspace: async () => ({
    id: "0195f000-0000-7000-8000-000000000002",
    reset: false,
    role: "OWNER",
  }),
}));

const REPO_ID = "0195f000-0000-7000-8000-000000000002";

function makeCtx() {
  return {
    db: {} as unknown as DbClient,
    prisma: {
      workspaceMember: {
        findFirst: async () => ({ role: "OWNER", workspaceId: REPO_ID }),
        findUnique: async () => ({ role: "OWNER" }),
      },
    },
    redis: {},
    req: { headers: new Headers() } as never,
    requestInfo: { requestId: "req-test" },
    session: { session: {}, user: { id: "user-1", role: "USER" } },
  };
}

describe("analysisRepo.loadLatestDocumentsWithContent", () => {
  type Query = { sql: string; values: readonly unknown[] };

  const ROW = {
    analysisId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    id: "0195f000-0000-7000-8000-000000000011",
    path: null,
    type: "README" as const,
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    version: "abc123",
  };

  function makeDocsDb(rows: unknown[]) {
    const findMany = vi.fn(async () =>
      rows.map((row) => ({ content: "# doc", id: (row as { id: string }).id })),
    );
    const queries: Query[] = [];
    const db = {
      $queryRawTyped: async (query: Query) => {
        queries.push(query);
        return rows;
      },
      document: { findMany },
    } as unknown as DbClient;

    return { db, queries };
  }

  it("asks for a per-type window instead of one global row cap", async () => {
    const { db, queries } = makeDocsDb([ROW]);

    await analysisRepo.loadLatestDocumentsWithContent(db, REPO_ID, "workspace-1");

    expect(queries).toHaveLength(1);
    expect(queries[0]?.values).toStrictEqual([
      REPO_ID,
      "workspace-1",
      null,
      MAX_SEARCHABLE_DOCUMENTS_PER_TYPE,
    ]);
    expect(queries[0]?.sql).toContain("PARTITION BY d.type, d.path");
  });

  it("keeps every version the window returns, so one type cannot hide the others", async () => {
    const { db } = makeDocsDb([
      ...Array.from({ length: MAX_SEARCHABLE_DOCUMENTS_PER_TYPE }, (_, index) => ({
        ...ROW,
        id: `0195f000-0000-7000-8000-00000000002${index}`,
        version: `readme-${index}`,
      })),
      { ...ROW, id: "0195f000-0000-7000-8000-000000000030", type: "API" as const },
    ]);

    const docs = await analysisRepo.loadLatestDocumentsWithContent(db, REPO_ID, "workspace-1");

    expect(docs).toHaveLength(MAX_SEARCHABLE_DOCUMENTS_PER_TYPE + 1);
    expect(new Set(docs.map((doc) => doc.type))).toStrictEqual(new Set(["README", "API"]));
  });

  it("scopes the window to the pinned analysis", async () => {
    const { db, queries } = makeDocsDb([]);

    await analysisRepo.loadLatestDocumentsWithContent(db, REPO_ID, "workspace-1", "analysis-1");

    expect(queries[0]?.values[2]).toBe("analysis-1");
  });
});

describe("workspaceSearchService.search", () => {
  it("returns nothing when the repo snapshot is missing", async () => {
    const db = { repo: { findUnique: async () => null } } as unknown as DbClient;

    await expect(
      workspaceSearchService.search(db, REPO_ID, "controller", "workspace-1"),
    ).resolves.toEqual([]);
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
