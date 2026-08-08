import { paginationQuerySchema } from "@server/core/db/pagination";
import { selectAuditLogSchema } from "@server/core/db/schema";
import type { z } from "zod";

export const getAuditLogsQuerySchema = paginationQuerySchema.extend({
  actor: selectAuditLogSchema.shape.actor.optional(),
  action: selectAuditLogSchema.shape.action.optional(),
});

export type GetAuditLogsQuery = z.infer<typeof getAuditLogsQuerySchema>;

export type RecordAuditLogInput = {
  actor: string;
  action: string;
  target: string;
  ipAddress: string;
};
