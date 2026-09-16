import { describe, expect, it } from "vitest";

import type { RepoMetrics } from "../engine/core/metrics.types";
import { ProjectPolicy } from "../engine/core/project-policy";
import {
  buildGroupKeySet,
  collectGroupsByKind,
  collectSemanticKinds,
  describeGroup,
  filterMeaningfulEntrypoints,
  getGenericGroupPenalty,
  getStrongGroups,
  isLikelyBarrelPath,
  isMeaningfulChildNode,
  isMeaningfulTopLevelNode,
  rankStructureNode,
  shouldKeepStructurePath,
  summarizeGroupImportance,
} from "./semantics";
import { createEmptyGroupEntry, type StructureGroupEntry } from "./structure-shared";

const makeNode = (overrides: Record<string, unknown> = {}) =>
  ({
    kind: "unknown",
    label: "src",
    markers: {
      api: false,
      config: false,
      entrypoint: false,
      risk: false,
      server: false,
      shared: false,
    },
    nodeType: "group",
    path: "src",
    score: 0,
    stats: {
      apiCount: 0,
      changeCouplingCount: 0,
      churnCount: 0,
      configCount: 0,
      dependencyHotspotCount: 0,
      entrypointCount: 0,
      frameworkCount: 0,
      graphWarningCount: 0,
      hotspotCount: 0,
      orphanCount: 0,
      pathCount: 0,
      riskCount: 0,
    },
    ...overrides,
  }) as Parameters<typeof rankStructureNode>[0];

type InspectNode = Parameters<typeof isMeaningfulTopLevelNode>[0];

const makeInspectNode = (overrides: Record<string, unknown> = {}): InspectNode =>
  makeNode(overrides);

const emptyMetrics = (): RepoMetrics =>
  ({
    dependencyHotspots: [],
    orphanModules: [],
  }) as unknown as RepoMetrics;

describe("collectSemanticKinds", () => {
  it("прокидывает семантические виды путей через ProjectPolicy", () => {
    const kinds = collectSemanticKinds("src/server/api/routes.ts", new Set());

    expect(kinds).toEqual(expect.arrayContaining(["api", "backend"]));
    expect(collectSemanticKinds("client/components/button.tsx", new Set())).toEqual(
      expect.arrayContaining(["frontend"]),
    );
  });
});

describe("describeGroup", () => {
  it("склеивает label группы и описание семантического вида", () => {
    expect(describeGroup("src/features", "frontend")).toBe(
      "src / features: UI, app shell or client-facing flow composition.",
    );
  });
});

describe("getGenericGroupPenalty", () => {
  it("для файлов штраф отсутствует", () => {
    expect(getGenericGroupPenalty(makeNode({ nodeType: "file", path: "src/app.ts" }))).toBe(0);
  });

  it("для generic-группы с неизвестным kind и слабыми сигналами штраф растёт", () => {
    const penalty = getGenericGroupPenalty(
      makeNode({
        kind: "unknown",
        markers: {
          api: false,
          config: false,
          entrypoint: false,
          risk: false,
          server: false,
          shared: false,
        },
        path: "src",
        stats: {
          apiCount: 0,
          changeCouplingCount: 0,
          churnCount: 0,
          configCount: 0,
          dependencyHotspotCount: 0,
          entrypointCount: 0,
          frameworkCount: 0,
          graphWarningCount: 0,
          hotspotCount: 0,
          orphanCount: 0,
          pathCount: 1,
          riskCount: 0,
        },
      }),
    );

    expect(penalty).toBeGreaterThan(0);
  });

  it("сильные сигналы и backend-kind снижают штраф (10 − 6 − 2 = 2)", () => {
    const penalty = getGenericGroupPenalty(
      makeNode({
        kind: "backend",
        markers: {
          api: false,
          config: false,
          entrypoint: true,
          risk: false,
          server: false,
          shared: false,
        },
        path: "src",
      }),
    );

    expect(penalty).toBe(2);
  });
});

describe("isLikelyBarrelPath", () => {
  it("распознаёт index-файлы и корневые index-файлы", () => {
    expect(isLikelyBarrelPath("src/index.ts")).toBe(true);
    expect(isLikelyBarrelPath("lib/features/index.jsx")).toBe(true);
    expect(isLikelyBarrelPath("index.js")).toBe(true);
  });

  it("не считает barrels обычные файлы", () => {
    expect(isLikelyBarrelPath("src/app.ts")).toBe(false);
    expect(isLikelyBarrelPath("src/my-index.ts")).toBe(false);
  });
});

describe("buildGroupKeySet", () => {
  it("дедуплицирует и группирует пути через deriveGroupId", () => {
    expect(buildGroupKeySet(["src/app.ts", "src/app.ts", "lib/x.ts"], new Set())).toEqual([
      "src/app.ts",
      "lib/x.ts",
    ]);
  });
});

describe("filterMeaningfulEntrypoints", () => {
  it("отбрасывает barrel-файлы, когда есть альтернативы", () => {
    expect(filterMeaningfulEntrypoints(["src/index.ts", "lib/main.ts"])).toEqual(["lib/main.ts"]);
  });

  it("возвращает исходные пути, если все — barrels", () => {
    expect(filterMeaningfulEntrypoints(["src/index.ts", "lib/index.ts"])).toEqual([
      "src/index.ts",
      "lib/index.ts",
    ]);
  });
});

describe("summarizeGroupImportance", () => {
  it("перечисляет причины по счётчикам", () => {
    const summary = summarizeGroupImportance({
      apiCount: 1,
      changeCouplingCount: 0,
      churnCount: 1,
      configCount: 0,
      dependencyHotspotCount: 0,
      entrypointCount: 2,
      frameworkCount: 0,
      graphWarningCount: 0,
      groupId: "src/api",
      hotspotCount: 0,
      orphanCount: 0,
      primaryKind: "api",
      riskCount: 0,
      sampleCount: 3,
    });

    expect(summary).toContain("contains likely entrypoints");
    expect(summary).toContain("surfaces public API or route files");
    expect(summary).toContain("shows recent git activity concentration");
  });

  it("без причин возвращает только describeGroup", () => {
    const summary = summarizeGroupImportance({
      apiCount: 0,
      changeCouplingCount: 0,
      churnCount: 0,
      configCount: 0,
      dependencyHotspotCount: 0,
      entrypointCount: 0,
      frameworkCount: 0,
      graphWarningCount: 0,
      groupId: "src/api",
      hotspotCount: 0,
      orphanCount: 0,
      primaryKind: "api",
      riskCount: 0,
      sampleCount: 1,
    });

    expect(summary).toBe("src / api: Public API and externally reachable interface paths.");
  });
});

describe("shouldKeepStructurePath", () => {
  const signalMap = new Map<
    string,
    Set<"api" | "config" | "entrypoint" | "fact" | "finding" | "hotspot" | "onboarding">
  >();

  it("отбрасывает чувствительные и игнорируемые пути", () => {
    expect(shouldKeepStructurePath(".env", signalMap, emptyMetrics(), new Set(), new Set())).toBe(
      false,
    );
    expect(
      shouldKeepStructurePath("generated/foo.ts", signalMap, emptyMetrics(), new Set(), new Set()),
    ).toBe(false);
  });

  it("сохраняет путь с сильным сигналом", () => {
    signalMap.set("src/app.ts", new Set(["entrypoint"]));

    expect(
      shouldKeepStructurePath("src/app.ts", signalMap, emptyMetrics(), new Set(), new Set()),
    ).toBe(true);
  });

  it("односегментный путь без сигналов не проходит порог", () => {
    signalMap.clear();
    expect(
      shouldKeepStructurePath("other.ts", signalMap, emptyMetrics(), new Set(), new Set()),
    ).toBe(false);
  });

  it("учитывает routeInventory и publicSurfacePaths в скоринге", () => {
    const metrics = {
      ...emptyMetrics(),
      routeInventory: { sourceFiles: ["src/api/routes.ts"] },
    } as RepoMetrics;

    expect(
      shouldKeepStructurePath("src/api/routes.ts", signalMap, metrics, new Set(), new Set()),
    ).toBe(true);
  });
});

describe("rankStructureNode", () => {
  it("награждает группы и значимые маркеры", () => {
    const base = rankStructureNode(makeNode());
    const marked = rankStructureNode(
      makeNode({
        kind: "api",
        markers: {
          api: true,
          config: false,
          entrypoint: true,
          risk: true,
          server: false,
          shared: false,
        },
        nodeType: "group",
        score: 10,
      }),
    );

    expect(marked).toBeGreaterThan(base);
  });
});

describe("isMeaningfulTopLevelNode", () => {
  it("generic-группа с одним путём без маркеров — не значимая", () => {
    const generic = makeInspectNode({
      markers: {
        api: false,
        config: false,
        entrypoint: false,
        risk: false,
        server: false,
        shared: false,
      },
      path: "src",
      stats: {
        apiCount: 0,
        changeCouplingCount: 0,
        churnCount: 0,
        configCount: 0,
        dependencyHotspotCount: 0,
        entrypointCount: 0,
        frameworkCount: 0,
        graphWarningCount: 0,
        hotspotCount: 0,
        orphanCount: 0,
        pathCount: 1,
        riskCount: 0,
      },
    });
    expect(isMeaningfulTopLevelNode(generic)).toBe(false);
  });

  it("entrypoint-маркер делает узел значимым", () => {
    const node = makeInspectNode({
      markers: {
        api: false,
        config: false,
        entrypoint: true,
        risk: false,
        server: false,
        shared: false,
      },
    });
    expect(isMeaningfulTopLevelNode(node)).toBe(true);
  });
});

describe("isMeaningfulChildNode", () => {
  it("file-barrel не значим, api-файл значим", () => {
    expect(
      isMeaningfulChildNode(makeNode({ nodeType: "file", path: "src/features/ui/index.ts" })),
    ).toBe(false);
    expect(
      isMeaningfulChildNode(
        makeNode({
          markers: {
            api: true,
            config: false,
            entrypoint: false,
            risk: false,
            server: false,
            shared: false,
          },
          nodeType: "file",
          path: "src/app.ts",
        }),
      ),
    ).toBe(true);
  });
});

describe("collectGroupsByKind", () => {
  it("группирует id групп по primary-виду", () => {
    const base = createEmptyGroupEntry();
    const groupMap = new Map<string, StructureGroupEntry>([
      ["src", { ...base, semanticCounts: { ...base.semanticCounts, backend: 1 } }],
      ["api", { ...base, semanticCounts: { ...base.semanticCounts, api: 1 } }],
    ]);

    const byKind = collectGroupsByKind(groupMap);

    expect(byKind.get("backend")).toEqual(["src"]);
    expect(byKind.get("api")).toEqual(["api"]);
  });
});

describe("getStrongGroups", () => {
  it("сортирует по скорингу и обрезает по лимиту", () => {
    const base = createEmptyGroupEntry();
    const groupMap = new Map<string, StructureGroupEntry>([
      ["weak", base],
      ["strong", { ...base, paths: ["a.ts", "b.ts"], riskTitles: ["r1"] }],
    ]);

    const result = getStrongGroups(["weak", "strong"], groupMap, 1);

    expect(result).toEqual(["strong"]);
  });
});

describe("ProjectPolicy integration", () => {
  it("deriveGroupId очевидные случаи", () => {
    expect(ProjectPolicy.deriveGroupId("api/routes.ts")).toBe("api");
    expect(ProjectPolicy.deriveGroupId("g0/a.ts")).toBe("g0");
    expect(ProjectPolicy.deriveGroupId(".env")).toBe(".env");
  });
});
