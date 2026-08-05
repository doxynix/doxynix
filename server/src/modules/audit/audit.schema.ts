import { paginationQuerySchema } from "@server/core/db/pagination";
import { z } from "zod";

export const getAuditLogsQuerySchema = paginationQuerySchema.extend({
  actor: z.string().max(100, "Actor query too long").optional(),
  action: z.string().max(150, "Action query too long").optional(),
});

export type GetAuditLogsQuery = z.infer<typeof getAuditLogsQuerySchema>;

export type RecordAuditLogInput = {
  actor: string;
  action: string;
  target: string;
  ipAddress: string;
};
