import type { AuditLog } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { auditMapper } from "./audit.mapper";
import { ActivityLogsOutputSchema, AuditLogSchema } from "./audit-logs.schemas";

function makeAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    createdAt: new Date("2024-01-01T00:00:00Z"),
    id: "0192f0aa-1111-7000-8000-000000000001",
    ip: "127.0.0.1",
    model: "Repo",
    operation: "create",
    payload: { data: { firstName: "John", isPublic: false } },
    requestId: "req-1",
    userAgent: null,
    userId: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d",
    ...overrides,
  };
}

describe("audit-logs response schemas", () => {
  it("declares exactly the fields auditMapper.toDto emits", () => {
    expect(Object.keys(auditMapper.toDto(makeAuditLog())).sort()).toEqual(
      Object.keys(AuditLogSchema.shape).sort(),
    );
  });

  it("round-trips the service response without adding, dropping or rewriting keys", () => {
    const response = {
      items: [auditMapper.toDto(makeAuditLog({ ip: null, requestId: null }))],
      nextCursor: "next-page-cursor",
    };

    expect(ActivityLogsOutputSchema.parse(response)).toEqual(response);
  });

  it("accepts a last page where the service leaves nextCursor undefined", () => {
    const response = { items: [], nextCursor: undefined };

    expect(ActivityLogsOutputSchema.parse(response)).toEqual(response);
  });
});
