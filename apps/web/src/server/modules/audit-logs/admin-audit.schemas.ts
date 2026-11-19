import { AuditModel, AuditOperation, CursorMetaSchema } from "@doxynix/shared";
import * as z from "zod";

import {
  CursorSchema,
  cursorPageSchema,
  DateRangeSchema,
  dateRangeMustBeOrdered,
} from "@/server/utils/pagination";

import { AuditLogSchema } from "./audit-logs.schemas";

export const AdminAuditFilterSchema = cursorPageSchema(50)
  .extend({
    actorId: z.uuid().optional(),
    model: z.enum(AuditModel).optional(),
    operation: z.enum(AuditOperation).optional(),
    search: CursorSchema.shape.search,
  })
  .extend(DateRangeSchema.shape)
  .superRefine(dateRangeMustBeOrdered);

export type AdminAuditFilterInput = z.infer<typeof AdminAuditFilterSchema>;

export const AdminAuditRefSchema = z.object({ id: z.uuid() });

export type AdminAuditRefInput = z.infer<typeof AdminAuditRefSchema>;

export const AdminAuditListSchema = z.object({
  items: z.array(AuditLogSchema),
  meta: CursorMetaSchema,
});
