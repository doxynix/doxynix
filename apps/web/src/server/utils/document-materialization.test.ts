import { describe, expect, it } from "vitest";

import { resolveDocumentMaterializedPath } from "./document-materialization";

describe("document-materialization", () => {
  it("returns the canonical artifact name for built-in docs", () => {
    expect(resolveDocumentMaterializedPath({ sourcePath: "src/app.ts", type: "README" })).toBe(
      "README.md",
    );
    expect(resolveDocumentMaterializedPath({ sourcePath: "src/app.ts", type: "API" })).toBe(
      "docs/API.md",
    );
    expect(
      resolveDocumentMaterializedPath({ sourcePath: "src/app.ts", type: "ARCHITECTURE" }),
    ).toBe("docs/ARCHITECTURE.md");
  });

  it("materializes code docs under the docs/code tree with normalized paths", () => {
    expect(
      resolveDocumentMaterializedPath({ sourcePath: "src\\server\\analysis.ts", type: "CODE_DOC" }),
    ).toBe("docs/code/src/server/analysis.ts.md");
    expect(
      resolveDocumentMaterializedPath({ sourcePath: " ./src/app.ts ", type: "CODE_DOC" }),
    ).toBe("docs/code/src/app.ts.md");
  });

  it("rejects code document materialization without a source path", () => {
    expect(() =>
      resolveDocumentMaterializedPath({ sourcePath: undefined, type: "CODE_DOC" }),
    ).toThrow("CODE_DOC requires source path for materialization");
    expect(() => resolveDocumentMaterializedPath({ sourcePath: "   ", type: "CODE_DOC" })).toThrow(
      "CODE_DOC requires source path for materialization",
    );
  });
});
