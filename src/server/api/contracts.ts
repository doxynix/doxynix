import { NotifyType, Status, Visibility } from "@prisma/client";
import { z } from "zod";

type ValidatePairType = { repoName?: string; repoOwner?: string };

export const PaginationSchema = z.object({
  cursor: z.coerce.number().int().min(1).max(1_000_000).nullish(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(1000).optional(),
});

export const RepoFilterSchema = PaginationSchema.extend({
  owner: z.string().trim().min(1).max(39).optional(),
  sortBy: z.enum(["name", "updatedAt", "createdAt"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(Status).optional(),
  visibility: z.enum(Visibility).optional(),
});

export type RepoFiltersInput = z.infer<typeof RepoFilterSchema>;

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
}).superRefine(validateRepoPair);

export type NotificationsFilterInput = z.infer<typeof NotificationsFilterSchema>;

export const NotificationsBulkFilterSchema = z
  .object({
    ...repoIdentityFields,
    search: z.string().trim().max(1000).optional(),
    type: z.enum(NotifyType).optional(),
  })
  .superRefine(validateRepoPair);

export type NotificationsBulkFilterInput = z.infer<typeof NotificationsBulkFilterSchema>;

export const OpenApiErrorResponses = {
  400: "Invalid request",
  401: "Authorization required",
  403: "Insufficient permissions",
  404: "Resource not found",
  409: "Resource conflict",
  422: "Data validation error",
  429: "Too many requests",
  500: "Internal server error",
  503: "Service temporarily unavailable",
} as const;
