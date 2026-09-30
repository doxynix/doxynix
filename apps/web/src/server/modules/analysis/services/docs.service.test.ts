import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock("@/shared/lib/shiki", () => ({ highlightCode: vi.fn(async () => ({ html: "" })) }));

import type { DbClient } from "@/server/core/db";

import { DocumentFormatter } from "../logic/section-graph-linker";
import { docsService } from "./docs.service";

const ANALYSIS_ID = "0195f000-0000-7000-8000-000000000001";
const REPO_ID = "0195f000-0000-7000-8000-000000000002";

const INPUT = { analysisId: ANALYSIS_ID, docType: "README" as const, repoId: REPO_ID };

const EXPECTED_SELECT = ["content", "createdAt", "id", "path", "type", "updatedAt", "version"];

const CONTENT =
  "# doxynix\n\nBootstrapped by file app.ts which mounts the router.\n\n## API\n\nRoutes live here.\n";

const GRAPH = { nodes: [{ id: "file:src/app.ts", label: "app.ts" }] };

type RowBuilder = (keys: string[]) => Record<string, unknown>;

function makeDb(rowByKey: RowBuilder) {
  const captured: { analysisQueried: boolean; analysisSelect?: unknown; documentSelect?: unknown } =
    { analysisQueried: false };

  const db = {
    analysis: {
      findUnique: (args: { select?: unknown }) => {
        captured.analysisQueried = true;
        captured.analysisSelect = args.select;
        return {
          metricsJson: null,
          resultJson: { dependencyGraph: GRAPH },
        };
      },
    },
    document: {
      findFirst: (args: { select?: unknown }) => {
        captured.documentSelect = args.select;
        const keys = Object.keys(args.select ?? {});
        return rowByKey(keys);
      },
    },
  } as unknown as DbClient;

  return { captured, db };
}

const makeRow: RowBuilder = (keys) => {
  const values: Record<string, unknown> = {
    content: CONTENT,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    id: "0195f000-0000-7000-8000-000000000003",
    path: "README.md",
    type: "README",
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    version: "abc123",
  };

  return Object.fromEntries(keys.map((key) => [key, values[key]]));
};

describe("docsService.getWithGraphLinks", () => {
  it("selects exactly the seven columns the endpoint documents", async () => {
    const { captured, db } = makeDb(makeRow);

    await docsService.getWithGraphLinks(db, INPUT);

    expect(Object.keys(captured.documentSelect as Record<string, unknown>)).toStrictEqual(
      EXPECTED_SELECT,
    );
  });

  it("does not query the analysis row, because no column ever held a dependency graph", async () => {
    const { captured, db } = makeDb(makeRow);

    await docsService.getWithGraphLinks(db, INPUT);

    // `dependencyGraph` is computed per analysis but never written to `resultJson`/`metricsJson`, so reading it back could only yield `undefined`; asserting the query is not made is the honest contract.
    expect(captured.analysisSelect).toBeUndefined();
    expect(captured.analysisQueried).toBe(false);
  });

  it("hands the formatter a complete content string and version", async () => {
    const { db } = makeDb(makeRow);

    const result = await docsService.getWithGraphLinks(db, INPUT);

    expect(result.content).toBe(CONTENT);
    expect(result.version).toBe("abc123");
    expect(result.sections).toStrictEqual(
      DocumentFormatter.withGraphLinks(CONTENT, null, INPUT.docType, "abc123").sections,
    );
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it("emits every selected field with a defined value, plus sections", async () => {
    const { db } = makeDb(makeRow);

    const result = await docsService.getWithGraphLinks(db, INPUT);

    expect(Object.keys(result).sort()).toStrictEqual([...EXPECTED_SELECT, "sections"].sort());
    for (const key of EXPECTED_SELECT) {
      expect(result[key as keyof typeof result]).toBeDefined();
    }
  });

  it("produces no graph links, because this endpoint has no graph to link against", async () => {
    const { db } = makeDb(makeRow);

    const result = await docsService.getWithGraphLinks(db, INPUT);

    // `withGraphLinks` accepts `null` and guards on `graph?.nodes`; the two endpoints that DO link are covered by `section-graph-linker.test.ts`.
    for (const section of result.sections) {
      expect(section.graphNodeIds).toStrictEqual([]);
    }
  });

  it("returns the document id but no longer leaks repoId / analysisId", async () => {
    const { db } = makeDb(makeRow);

    const result = await docsService.getWithGraphLinks(db, INPUT);

    expect(result.id).toBeDefined();
    for (const key of ["analysisId", "repoId"]) {
      expect(Object.hasOwn(result, key)).toBe(false);
    }
  });

  it("keeps a null document path rather than dropping the key", async () => {
    const { db } = makeDb((keys) => ({ ...makeRow(keys), path: null }));

    const result = await docsService.getWithGraphLinks(db, INPUT);

    expect(result.path).toBeNull();
    expect(Object.hasOwn(result, "path")).toBe(true);
  });
});

describe("docsService.pinAuditToDocs", () => {
  const COMMIT_SHA = "deadbeef";
  const AUDIT_PATH = "src/app.ts";

  // The blob `analyze-file.task.ts` writes: the preview plus top-level ref keys.
  function makeRedis(overrides: Record<string, unknown> = {}) {
    return {
      get: async () => ({
        action: "quick-file-audit",
        analysisId: ANALYSIS_ID,
        analysisRef: null,
        commitSha: COMMIT_SHA,
        confidence: "high",
        consistency: "matched",
        consistencyNote: null,
        content: "# app.ts\n\nExports the router.\n",
        contextDiagnostics: {},
        contextMeta: {},
        path: AUDIT_PATH,
        summary: "s",
        title: "t",
        ...overrides,
      }),
    } as unknown as Parameters<typeof docsService.pinAuditToDocs>[1];
  }

  function makePinDb(created: { analysis?: unknown } = {}) {
    const captured: { createData?: Record<string, unknown> } = {};
    const db = {
      analysis: { findUnique: async () => ({ id: ANALYSIS_ID }) },
      document: {
        create: async (args: { data: Record<string, unknown> }) => {
          captured.createData = args.data;
          return { id: "0195f000-0000-7000-8000-000000000004" };
        },
      },
    } as unknown as DbClient;
    return { captured, created, db };
  }

  it("records the commit sha as the version and links the document to its analysis", async () => {
    const { captured, db } = makePinDb();

    await docsService.pinAuditToDocs(db, makeRedis(), "user-1", {
      path: AUDIT_PATH,
      repoId: REPO_ID,
    });

    expect(captured.createData?.version).toBe(COMMIT_SHA);
    expect(captured.createData?.analysis).toStrictEqual({ connect: { id: ANALYSIS_ID } });
  });

  it("falls back to a manual version when the cached audit carries no analysis ref", async () => {
    const { captured, db } = makePinDb();

    await docsService.pinAuditToDocs(
      db,
      makeRedis({ analysisId: undefined, commitSha: undefined }),
      "user-1",
      { path: AUDIT_PATH, repoId: REPO_ID },
    );

    expect(captured.createData?.version).toBe("manual");
    expect(captured.createData?.analysis).toBeUndefined();
  });

  it("still links the analysis when only the commit sha is missing", async () => {
    const { captured, db } = makePinDb();

    await docsService.pinAuditToDocs(db, makeRedis({ commitSha: undefined }), "user-1", {
      path: AUDIT_PATH,
      repoId: REPO_ID,
    });

    expect(captured.createData?.version).toBe("manual");
    expect(captured.createData?.analysis).toStrictEqual({ connect: { id: ANALYSIS_ID } });
  });
});
