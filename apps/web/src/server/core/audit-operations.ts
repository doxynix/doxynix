import { AuditOperation } from "@doxynix/shared";

export const AUDIT_OPERATION_BY_WIRE_NAME: Record<string, AuditOperation> = {
  create: AuditOperation.CREATE,
  createMany: AuditOperation.CREATE_MANY,
  createManyAndReturn: AuditOperation.CREATE_MANY_AND_RETURN,
  delete: AuditOperation.DELETE,
  deleteMany: AuditOperation.DELETE_MANY,
  update: AuditOperation.UPDATE,
  updateMany: AuditOperation.UPDATE_MANY,
  updateManyAndReturn: AuditOperation.UPDATE_MANY_AND_RETURN,
  upsert: AuditOperation.UPSERT,
};
