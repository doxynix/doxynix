import { describe, expect, it } from "vitest";

import { formatDocType, renderDocsListTable } from "./docs.formatter";

describe("docs formatter", () => {
  it("maps document types to display labels", () => {
    expect(formatDocType("README")).toContain("README");
    expect(formatDocType("ARCHITECTURE")).toContain("ARCHITECTURE");
    expect(formatDocType("unknown")).toContain("unknown");
  });

  it("renders docs list table with path and amount of updates", () => {
    const output = renderDocsListTable([
      {
        path: "docs/architecture.md",
        type: "ARCHITECTURE",
        updatedAt: "2024-01-01T00:00:00.000Z",
        version: "v1.2.3",
      },
    ] as any);

    expect(output).toContain("docs/architecture.md");
    expect(output).toContain("ARCHITECTURE");
    expect(output).toContain("v1.2.3");
  });
});
