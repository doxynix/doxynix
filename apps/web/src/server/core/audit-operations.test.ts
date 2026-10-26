import { AuditModel, AuditOperation } from "@doxynix/shared";
import { describe, expect, it } from "vitest";

import { AUDIT_OPERATION_BY_WIRE_NAME } from "./audit-operations";

// Prisma hands `$allOperations` the wire name (`create`), never the schema name
// (`CREATE`); the audit hook silently stopped firing when the two were conflated.
describe("AUDIT_OPERATION_BY_WIRE_NAME", () => {
  it("covers every mutation Prisma can report", () => {
    const wireNames = [
      "create",
      "createMany",
      "createManyAndReturn",
      "delete",
      "deleteMany",
      "update",
      "updateMany",
      "updateManyAndReturn",
      "upsert",
    ];

    expect(Object.keys(AUDIT_OPERATION_BY_WIRE_NAME).toSorted()).toEqual(wireNames.toSorted());
  });

  it("maps every wire name to a real AuditOperation member", () => {
    const allowed = new Set<string>(Object.values(AuditOperation));

    for (const [wireName, operation] of Object.entries(AUDIT_OPERATION_BY_WIRE_NAME)) {
      expect(allowed, `${wireName} -> ${operation}`).toContain(operation);
    }
  });

  it("maps to the matching member rather than a positional guess", () => {
    expect(AUDIT_OPERATION_BY_WIRE_NAME.create).toBe(AuditOperation.CREATE);
    expect(AUDIT_OPERATION_BY_WIRE_NAME.createManyAndReturn).toBe(
      AuditOperation.CREATE_MANY_AND_RETURN,
    );
    expect(AUDIT_OPERATION_BY_WIRE_NAME.deleteMany).toBe(AuditOperation.DELETE_MANY);
  });

  it("never matches a read, so reads stay out of the audit log", () => {
    for (const readOp of ["findMany", "findUnique", "findFirst", "count", "aggregate"]) {
      expect(AUDIT_OPERATION_BY_WIRE_NAME[readOp]).toBeUndefined();
    }
  });

  it("keeps AuditLog itself auditable-in-principle but excluded by name", () => {
    expect(AuditModel).not.toHaveProperty("AuditLog");
  });
});
