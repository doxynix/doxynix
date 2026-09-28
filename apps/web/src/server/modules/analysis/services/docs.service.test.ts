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
  const captured: { documentSelect?: unknown; analysisSelect?: unknown } = {};

  const db = {
    analysis: {
      findUnique: (args: { select?: unknown }) => {
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
    expect(Object.keys(captured.analysisSelect as Record<string, unknown>)).toStrictEqual([
      "metricsJson",
      "resultJson",
    ]);
  });

  it("hands the formatter a complete content string and version", async () => {
    const { db } = makeDb(makeRow);

    const result = await docsService.getWithGraphLinks(db, INPUT);

    expect(result.content).toBe(CONTENT);
    expect(result.version).toBe("abc123");
    expect(result.sections).toStrictEqual(
      DocumentFormatter.withGraphLinks(CONTENT, GRAPH, INPUT.docType, "abc123").sections,
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

  it("links sections to the graph, proving the document column reached the formatter", async () => {
    const { db } = makeDb(makeRow);

    const result = await docsService.getWithGraphLinks(db, INPUT);

    expect(
      result.sections.some((section) => section.graphNodeIds.includes("file:src/app.ts")),
    ).toBe(true);
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
