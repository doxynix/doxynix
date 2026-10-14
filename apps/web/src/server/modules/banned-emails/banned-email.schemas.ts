import { BannedEmailReasonSchema, PaginationMetaSchema } from "@doxynix/shared";
import * as z from "zod";

import {
  DateRangeSchema,
  dateRangeMustBeOrdered,
  PaginationSchema,
} from "@/server/utils/pagination";

export const BannedEmailFilterSchema = PaginationSchema.extend({
  reason: z.optional(BannedEmailReasonSchema),
  ...DateRangeSchema.shape,
}).superRefine(dateRangeMustBeOrdered);

export type BannedEmailFilterInput = z.infer<typeof BannedEmailFilterSchema>;

export const BannedEmailCreateSchema = z.object({
  email: z.email(),
  reason: z.optional(BannedEmailReasonSchema),
});

export type BannedEmailCreateInput = z.infer<typeof BannedEmailCreateSchema>;

export const BannedEmailRefSchema = z.object({ id: z.uuid() });

export type BannedEmailRefInput = z.infer<typeof BannedEmailRefSchema>;

export const BannedEmailSchema = z.object({
  createdAt: z.date(),
  email: z.email(),
  id: z.uuid(),
  reason: BannedEmailReasonSchema,
});

export type BannedEmail = z.infer<typeof BannedEmailSchema>;

export const BannedEmailListSchema = z.object({
  items: z.array(BannedEmailSchema),
  meta: PaginationMetaSchema,
});
