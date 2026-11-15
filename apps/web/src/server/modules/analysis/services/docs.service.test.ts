import { MessageCode } from "@doxynix/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock("@/shared/lib/shiki", () => ({ highlightCode: vi.fn(async () => ({ html: "" })) }));
// The real pipeline loads every Shiki grammar, which costs seconds per call in a unit test.
vi.mock("@/server/modules/analysis/services/markdown-to-html", () => ({
  markdownToHtml: vi.fn(async () => "<p>rendered</p>"),
}));

import type { DbClient } from "@/server/core/db";

import { analysisRepo } from "../analysis.repository";
import { DocumentFormatter } from "../logic/section-graph-linker";
import { markdownToHtml } from "../services/markdown-to-html";
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
  const captured: {
    analysisQueried: boolean;
    analysisSelect?: unknown;
    documentSelect?: unknown;
    documentWhere?: Record<string, unknown>;
    repoSelect?: unknown;
  } = { analysisQueried: false };

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
      findFirst: (args: { select?: unknown; where?: Record<string, unknown> }) => {
        captured.documentSelect = args.select;
        captured.documentWhere = args.where;
        const keys = Object.keys(args.select ?? {});
        return rowByKey(keys);
      },
    },
    repo: {
      findUnique: (args: { select?: unknown }) => {
        captured.repoSelect = args.select;
        return {
          analyses: [{ id: ANALYSIS_ID }],
          defaultBranch: "main",
          id: REPO_ID,
          name: "doxynix",
          owner: "doxynix-org",
          url: "https://github.com/doxynix-org/doxynix",
        };
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

    await docsService.getWithGraphLinks(db, INPUT, "workspace-1");

    expect(Object.keys(captured.documentSelect as Record<string, unknown>)).toStrictEqual(
      EXPECTED_SELECT,
    );
  });

  it("does not query the analysis row, because no column ever held a dependency graph", async () => {
    const { captured, db } = makeDb(makeRow);

    await docsService.getWithGraphLinks(db, INPUT, "workspace-1");

    // `dependencyGraph` is computed per analysis but never written to `resultJson`/`metricsJson`, so reading it back could only yield `undefined`; asserting the query is not made is the honest contract.
    expect(captured.analysisSelect).toBeUndefined();
    expect(captured.analysisQueried).toBe(false);
  });

  it("hands the formatter a complete content string and version", async () => {
    const { db } = makeDb(makeRow);

    const result = await docsService.getWithGraphLinks(db, INPUT, "workspace-1");

    expect(result.content).toBe(CONTENT);
    expect(result.version).toBe("abc123");
    expect(result.sections).toStrictEqual(
      DocumentFormatter.withGraphLinks(CONTENT, null, INPUT.docType, "abc123").sections,
    );
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it("emits every selected field with a defined value, plus sections", async () => {
    const { db } = makeDb(makeRow);

    const result = await docsService.getWithGraphLinks(db, INPUT, "workspace-1");

    expect(Object.keys(result).sort()).toStrictEqual([...EXPECTED_SELECT, "sections"].sort());
    for (const key of EXPECTED_SELECT) {
      expect(result[key as keyof typeof result]).toBeDefined();
    }
  });

  it("produces no graph links, because this endpoint has no graph to link against", async () => {
    const { db } = makeDb(makeRow);

    const result = await docsService.getWithGraphLinks(db, INPUT, "workspace-1");

    // `withGraphLinks` accepts `null` and guards on `graph?.nodes`; the two endpoints that DO link are covered by `section-graph-linker.test.ts`.
    for (const section of result.sections) {
      expect(section.graphNodeIds).toStrictEqual([]);
    }
  });

  it("returns the document id but no longer leaks repoId / analysisId", async () => {
    const { db } = makeDb(makeRow);

    const result = await docsService.getWithGraphLinks(db, INPUT, "workspace-1");

    expect(result.id).toBeDefined();
    for (const key of ["analysisId", "repoId"]) {
      expect(Object.hasOwn(result, key)).toBe(false);
    }
  });

  it("keeps a null document path rather than dropping the key", async () => {
    const { db } = makeDb((keys) => ({ ...makeRow(keys), path: null }));

    const result = await docsService.getWithGraphLinks(db, INPUT, "workspace-1");

    expect(result.path).toBeNull();
    expect(Object.hasOwn(result, "path")).toBe(true);
  });
});

describe("docsService.getDocumentContent", () => {
  // `getDocumentContent` runs no `select` on the document, so the fake must return the whole row.
  const fullRow: RowBuilder = () => makeRow(EXPECTED_SELECT);

  it("reads a narrow repo ref instead of the whole snapshot", async () => {
    const { captured, db } = makeDb(fullRow);
    const snapshotSpy = vi.spyOn(analysisRepo, "getRepoSnapshot");

    await docsService.getDocumentContent(db, REPO_ID, "README", "workspace-1", ANALYSIS_ID);

    expect(snapshotSpy).not.toHaveBeenCalled();
    snapshotSpy.mockRestore();

    const select = captured.repoSelect as Record<string, unknown>;
    expect(Object.keys(select).sort()).toStrictEqual([
      "analyses",
      "defaultBranch",
      "id",
      "name",
      "owner",
      "url",
    ]);
    expect(select).not.toHaveProperty("resultJson");
    expect(select).not.toHaveProperty("metricsJson");
    expect((select.analyses as { select?: unknown }).select).toStrictEqual({ id: true });
    expect(vi.mocked(markdownToHtml)).toHaveBeenCalledWith({
      content: CONTENT,
      name: "doxynix",
      owner: "doxynix-org",
    });
  });

  it("still pins the document lookup to the selected analysis", async () => {
    const { captured, db } = makeDb(fullRow);

    const result = await docsService.getDocumentContent(
      db,
      REPO_ID,
      "README",
      "workspace-1",
      ANALYSIS_ID,
    );

    expect(captured.documentWhere?.analysis).toStrictEqual({ id: ANALYSIS_ID });
    expect(result.id).toBe("0195f000-0000-7000-8000-000000000003");
  });

  it("throws REPO_NOT_FOUND when the repo is missing", async () => {
    const db = { repo: { findUnique: async () => null } } as unknown as DbClient;

    await expect(
      docsService.getDocumentContent(db, REPO_ID, "README", "workspace-1", ANALYSIS_ID),
    ).rejects.toMatchObject({
      messageCode: MessageCode.REPO_NOT_FOUND,
      publicMessage: "Repository not found",
    });
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
      analysis: { findFirst: async () => ({ id: ANALYSIS_ID }) },
      document: {
        create: async (args: { data: Record<string, unknown> }) => {
          captured.createData = args.data;
          return { id: "0195f000-0000-7000-8000-000000000004" };
        },
      },
      repo: { findUnique: async () => ({ id: REPO_ID }) },
    } as unknown as DbClient;
    return { captured, created, db };
  }

  it("records the commit sha as the version and links the document to its analysis", async () => {
    const { captured, db } = makePinDb();

    await docsService.pinAuditToDocs(
      db,
      makeRedis(),
      "user-1",
      {
        path: AUDIT_PATH,
        repoId: REPO_ID,
      },
      "workspace-1",
    );

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
      "workspace-1",
    );

    expect(captured.createData?.version).toBe("manual");
    expect(captured.createData?.analysis).toBeUndefined();
  });

  it("still links the analysis when only the commit sha is missing", async () => {
    const { captured, db } = makePinDb();

    await docsService.pinAuditToDocs(
      db,
      makeRedis({ commitSha: undefined }),
      "user-1",
      {
        path: AUDIT_PATH,
        repoId: REPO_ID,
      },
      "workspace-1",
    );

    expect(captured.createData?.version).toBe("manual");
    expect(captured.createData?.analysis).toStrictEqual({ connect: { id: ANALYSIS_ID } });
  });
});
