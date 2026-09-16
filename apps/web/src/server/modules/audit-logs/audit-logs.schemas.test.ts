import { describe, expect, it } from "vitest";

import { AuditLogSchema, type AuditLogType, type AuditSeverityType } from "./audit-logs.schemas";

function makeValidDto(): AuditLogType {
  return {
    actionTitle: "Created",
    browser: "Chrome 124 on Windows 10",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    details: [{ label: "name", value: "my-repo" }],
    deviceType: "desktop",
    entityType: "Repository",
    iconKey: "github",
    id: "log-1",
    ip: "1.2.3.4",
    rawPayload: { data: { name: "my-repo" } },
    requestId: "req-1",
    severity: "success",
    targetName: "my-repo",
  };
}

describe("AuditLogSchema", () => {
  it("parses a valid full DTO", () => {
    const dto = makeValidDto();
    expect(AuditLogSchema.parse(dto)).toEqual(dto);
  });

  it.each([
    ["severity outside enum", { severity: "extreme" }],
    ["deviceType outside enum", { deviceType: "vr" }],
    ["details item missing label", { details: [{ value: "x" }] }],
    ["createdAt not a Date", { createdAt: "not-a-date" }],
    ["rawPayload missing", { rawPayload: undefined }],
  ])("rejects invalid input: %s", (_name, patch) => {
    expect(AuditLogSchema.safeParse({ ...makeValidDto(), ...patch }).success).toBe(false);
  });

  it("accepts null optionals (ip, requestId, details)", () => {
    const parsed = AuditLogSchema.parse({
      ...makeValidDto(),
      details: null,
      ip: null,
      requestId: null,
    });

    expect(parsed.ip).toBeNull();
    expect(parsed.requestId).toBeNull();
    expect(parsed.details).toBeNull();
  });

  it("accepts every severity variant and stays assignable to AuditSeverityType", () => {
    const severities: AuditSeverityType[] = ["info", "warning", "error", "success"];

    for (const severity of severities) {
      const parsed = AuditLogSchema.parse({ ...makeValidDto(), severity });
      expect(parsed.severity).toBe(severity);
    }
  });

  it("returns a result compatible with AuditLogType at the type level", () => {
    const parsed: AuditLogType = AuditLogSchema.parse(makeValidDto());
    expect(parsed.actionTitle).toBe("Created");
  });
});
