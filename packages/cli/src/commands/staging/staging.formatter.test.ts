import { describe, expect, it } from "vitest";

import { renderStagedFilesTable } from "./staging.formatter";

describe("staging formatter", () => {
  it("renders a staged files table from object data", () => {
    const output = renderStagedFilesTable({
      "src/app.ts": { content: "const x = 1;\nconst y = 2;" },
    } as any);

    expect(output).toContain("src/app.ts");
    expect(output).toContain("B");
    expect(output).toContain("2 lines");
  });

  it("renders a table from an array of staged items", () => {
    const output = renderStagedFilesTable([{ content: "hello\nworld", filePath: "README.md" }]);

    expect(output).toContain("README.md");
    expect(output).toContain("2 lines");
    expect(output).toContain("File Path");
  });
});
