import { CursorMetaSchema, NotificationSchema, NotifyType } from "@doxynix/shared";
import * as z from "zod";

import {
  CursorSchema,
  DateRangeSchema,
  dateRangeMustBeOrdered,
  PaginationSchema,
} from "@/server/utils/pagination";

type ValidatePairType = { repoName?: string; repoOwner?: string };

const repoIdentityFields = {
  repoName: z.string().trim().min(1).max(255).optional(),
  repoOwner: z.string().trim().min(1).max(39).optional(),
};
const validateRepoPair = (data: ValidatePairType, ctx: z.RefinementCtx) => {
  if ((data.repoName == null) !== (data.repoOwner == null)) {
    const message = "repoName and repoOwner must be provided together";
    ctx.addIssue({ code: "custom", message, path: ["repoName"] });
    ctx.addIssue({ code: "custom", message, path: ["repoOwner"] });
  }
};

export const NotificationsFilterSchema = PaginationSchema.extend({
  ...repoIdentityFields,
  isRead: z.boolean().optional(),
  type: z.enum(NotifyType).optional(),
  ...DateRangeSchema.shape,
})
  .superRefine(validateRepoPair)
  .superRefine(dateRangeMustBeOrdered);

export type NotificationsFilterInput = z.infer<typeof NotificationsFilterSchema>;

export const NotificationsFeedSchema = CursorSchema.extend({
  isRead: z.boolean().optional(),
  type: z.enum(NotifyType).optional(),
});

export type NotificationsFeedInput = z.infer<typeof NotificationsFeedSchema>;

export const NotificationsFeedOutputSchema = z.object({
  items: z.array(NotificationSchema),
  meta: CursorMetaSchema,
});

export const NotificationsBulkFilterSchema = z
  .object({
    ...repoIdentityFields,
    search: z.string().trim().max(1000).optional(),
    type: z.enum(NotifyType).optional(),
  })
  .superRefine(validateRepoPair);

export type NotificationsBulkFilterInput = z.infer<typeof NotificationsBulkFilterSchema>;
