import { describe, expect, it } from "vitest";

import { getLikelyEntrypoints } from "./entrypoints";

describe("getLikelyEntrypoints", () => {
  it("keeps real runtime entrypoints and ignores config files", () => {
    const files = [
      { content: "", path: "src/app.ts" },
      { content: "", path: "src/server/routes.ts" },
      { content: "", path: "tsconfig.json" },
      { content: "", path: "src/shared/util.ts" },
    ];

    const inboundByFile = new Map([
      ["src/app.ts", 0],
      ["src/server/routes.ts", 1],
      ["tsconfig.json", 5],
      ["src/shared/util.ts", 2],
    ]);
    const apiSurfaceByFile = new Map([
      ["src/app.ts", 0],
      ["src/server/routes.ts", 4],
      ["tsconfig.json", 0],
      ["src/shared/util.ts", 0],
    ]);

    const result = getLikelyEntrypoints(
      files,
      inboundByFile,
      apiSurfaceByFile,
      new Set(["src/app.ts"]),
    );

    expect(result).toContain("src/app.ts");
    expect(result).toContain("src/server/routes.ts");
    expect(result).not.toContain("tsconfig.json");
  });

  it("detects api files with zero inbound references", () => {
    const files = [{ content: "", path: "src/api/user.ts" }];
    const result = getLikelyEntrypoints(
      files,
      new Map([["src/api/user.ts", 0]]),
      new Map([["src/api/user.ts", 2]]),
      new Set(),
    );

    expect(result).toEqual(["src/api/user.ts"]);
  });
});
