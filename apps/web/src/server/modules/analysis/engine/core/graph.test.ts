import { describe, expect, it } from "vitest";

import {
  collectAliasRules,
  findDependencyCycles,
  isLikelyInternalImportSpecifier,
  resolveModuleImport,
  resolveRelativeImport,
} from "./graph";

describe("graph helpers", () => {
  it("recognizes relative, alias and hash-style internal imports", () => {
    expect(isLikelyInternalImportSpecifier("./utils")).toBe(true);
    expect(isLikelyInternalImportSpecifier("@/app")).toBe(true);
    expect(isLikelyInternalImportSpecifier("~/lib")).toBe(true);
    expect(isLikelyInternalImportSpecifier("#internal")).toBe(true);
    expect(isLikelyInternalImportSpecifier("react")).toBe(false);
  });

  it("resolves relative imports against the current file position", () => {
    const fileSet = new Set(["src/utils/helpers.ts", "src/utils/index.ts", "src/server/app.ts"]);

    expect(resolveRelativeImport("src/server/app.ts", "../utils", fileSet)).toBe(
      "src/utils/index.ts",
    );
    expect(resolveRelativeImport("src/server/app.ts", "../missing", fileSet)).toBeNull();
  });

  it("resolves module imports by alias and basename fallback", () => {
    const fileSet = new Set([
      "src/features/user.ts",
      "src/features/index.ts",
      "src/server/context.ts",
    ]);
    const filesByBaseName = new Map<string, string[]>([["user", ["src/features/user.ts"]]]);
    const aliasRules = [{ prefix: "@/", targets: ["src/"] }];

    expect(resolveModuleImport("@/features/user", fileSet, filesByBaseName, aliasRules)).toBe(
      "src/features/user.ts",
    );
    expect(resolveModuleImport("user", fileSet, filesByBaseName)).toBe("src/features/user.ts");
  });

  it("collects tsconfig path aliases and detects directed cycles", () => {
    const files = [
      {
        content:
          '{"compilerOptions":{"baseUrl":".","paths":{"@app/*":["src/*"],"@core/*":["core/*"]}}}',
        path: "configs/tsconfig.json",
      },
    ];

    const aliasRules = collectAliasRules(files);
    expect(aliasRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ prefix: "@app/", targets: expect.any(Array) }),
      ]),
    );

    const graph = new Map<string, Set<string>>([
      ["a", new Set(["b"])],
      ["b", new Set(["c"])],
      ["c", new Set(["a"])],
    ]);

    const cycles = findDependencyCycles(graph);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toEqual(["a", "b", "c"]);
  });
});
