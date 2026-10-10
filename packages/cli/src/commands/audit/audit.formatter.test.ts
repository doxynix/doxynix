import { describe, expect, it } from "vitest";

import { renderAuditTable } from "./audit.formatter";

describe("audit formatter", () => {
  it("renders the audit log table with action and details", () => {
    const output = renderAuditTable([
      {
        actionTitle: "GitHub repo linked",
        createdAt: "2024-01-01T00:00:00.000Z",
        details: [{ label: "Status", value: "Success" }],
        entityType: "github-repository",
        id: "audit-12345",
        targetName: "acme/platform",
      },
    ] as any);

    expect(output).toContain("GitHub repo linked");
    expect(output).toContain("acme/platform");
    expect(output).toContain("Status: Success");
  });
});
