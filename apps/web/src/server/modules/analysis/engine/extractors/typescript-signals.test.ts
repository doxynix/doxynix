import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FileSignals } from "../core/discovery.types";

vi.mock("./tree-sitter-signals", () => ({
  collectTreeSitterSignals: vi.fn(),
}));

vi.mock("./regex-signals", () => ({
  collectRegexSignals: vi.fn(),
}));

import { collectRegexSignals } from "./regex-signals";
import { collectTreeSitterSignals } from "./tree-sitter-signals";
import { collectTypeScriptSignals } from "./typescript-signals";

const file = (path: string, content = "") => ({ content, path });

const baseTreeSitterSignals = (overrides: Partial<FileSignals> = {}): FileSignals => ({
  analysisMode: "tree-sitter",
  apiSurface: 0,
  complexityMetrics: { complexity: 0, maxNesting: 0 },
  confidence: 80,
  entrypointHint: false,
  entrypointRefs: [],
  exports: 0,
  frameworkHints: [],
  imports: ["hono"],
  path: "src/app.ts",
  routes: [],
  source: "extraction",
  symbols: [],
  ...overrides,
});

const heuristicFallback: FileSignals = {
  analysisMode: "heuristic",
  apiSurface: 0,
  complexityMetrics: { complexity: 0, maxNesting: 0 },
  confidence: 60,
  entrypointHint: false,
  exports: 0,
  frameworkHints: [],
  imports: [],
  path: "src/app.ts",
  routes: [],
  source: "extraction",
  symbols: [],
};

describe("collectTypeScriptSignals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("при недоступном tree-sitter делает fallback на regex-сигналы", async () => {
    vi.mocked(collectTreeSitterSignals).mockResolvedValue(null);
    vi.mocked(collectRegexSignals).mockReturnValue(heuristicFallback);

    const result = await collectTypeScriptSignals(file("src/app.ts", "export const x = 1;"));

    expect(collectRegexSignals).toHaveBeenCalledWith(file("src/app.ts", "export const x = 1;"));
    expect(result.analysisMode).toBe("heuristic");
    expect(result.confidence).toBe(60);
  });

  it("сохраняет tree-sitter сигналы и дополняет confidence/analysisMode", async () => {
    vi.mocked(collectTreeSitterSignals).mockResolvedValue(baseTreeSitterSignals());

    const result = await collectTypeScriptSignals(file("src/app.ts", ""));

    expect(collectRegexSignals).not.toHaveBeenCalled();
    expect(result.analysisMode).toBe("tree-sitter");
    expect(result.confidence).toBe(80);
    expect(result.apiSurface).toBe(0);
  });

  it("распознаёт runtime-bootstrap паттерны (new Hono) и добавляет entrypointRef + факт Hono", async () => {
    vi.mocked(collectTreeSitterSignals).mockResolvedValue(
      baseTreeSitterSignals({ imports: ["hono"] }),
    );

    const result = await collectTypeScriptSignals(file("src/app.ts", "const app = new Hono();"));

    expect(result.entrypointHint).toBe(true);
    expect(result.entrypointRefs?.[0]).toMatchObject({
      confidence: 78,
      kind: "runtime",
      path: "src/app.ts",
      reason: "runtime bootstrap pattern detected in TypeScript/JavaScript source",
    });
    expect(result.frameworkHints).toContainEqual(
      expect.objectContaining({ confidence: 90, name: "Hono" }),
    );
  });

  it("добавляет library-entrypointRef для index-файла с экспортами", async () => {
    vi.mocked(collectTreeSitterSignals).mockResolvedValue(
      baseTreeSitterSignals({ exports: 2, path: "src/index.ts" }),
    );

    const result = await collectTypeScriptSignals(file("src/index.ts", ""));

    expect(result.entrypointRefs).toHaveLength(1);
    expect(result.entrypointRefs?.[0]).toMatchObject({
      confidence: 66,
      kind: "library",
      path: "src/index.ts",
      reason: "exporting index file suggests package public surface",
    });
  });

  it("не добавляет library-ref для не-index файла", async () => {
    vi.mocked(collectTreeSitterSignals).mockResolvedValue(baseTreeSitterSignals({ exports: 2 }));

    const result = await collectTypeScriptSignals(file("src/utils.ts", ""));

    expect(result.entrypointRefs).toEqual([]);
  });

  it("учитывает publicProcedure/adminProcedure в extraApiSurface", async () => {
    vi.mocked(collectTreeSitterSignals).mockResolvedValue(baseTreeSitterSignals());

    const result = await collectTypeScriptSignals(
      file(
        "src/api/trpc.ts",
        "list: publicProcedure.query(() => []),\ncreate: adminProcedure.mutation(() => {}),",
      ),
    );

    expect(result.apiSurface).toBe(2);
  });

  it("учитывает GET/POST-токен с присваиванием/вызовом в extraApiSurface", async () => {
    vi.mocked(collectTreeSitterSignals).mockResolvedValue(baseTreeSitterSignals());

    const result = await collectTypeScriptSignals(
      file("src/api/hono.ts", "const GET = app.get;\nconst POST: string = 'x'"),
    );

    expect(result.apiSurface).toBe(2);
  });

  it("наследует entrypointHint от tree-sitter сигналов, если тот уже true", async () => {
    vi.mocked(collectTreeSitterSignals).mockResolvedValue(
      baseTreeSitterSignals({ entrypointHint: true }),
    );

    const result = await collectTypeScriptSignals(file("src/app.ts", "export const x = 1;"));

    expect(result.entrypointHint).toBe(true);
  });
});
