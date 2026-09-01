import type { z } from "zod";

import { paginationQuerySchema } from "@/core/db/pagination";
import { selectAuditLogSchema } from "@/core/db/schema";

export const getAuditLogsQuerySchema = paginationQuerySchema.extend({
  action: selectAuditLogSchema.shape.action.optional(),
  actor: selectAuditLogSchema.shape.actor.optional(),
});

export type GetAuditLogsQuery = z.infer<typeof getAuditLogsQuerySchema>;

export type RecordAuditLogInput = {
  actor: string;
  action: string;
  target: string;
  ipAddress: string;
};
