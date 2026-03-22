import { NotifyType, Status, Visibility } from "@prisma/client";
import { z } from "zod";

export const PaginationSchema = z.object({
  cursor: z.coerce.number().min(1).max(1000000).nullish(),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().trim().max(1000).optional(),
});

export const RepoFilterSchema = PaginationSchema.extend({
  owner: z.string().trim().min(1).max(39).optional(),
  sortBy: z.enum(["name", "updatedAt", "createdAt"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(Status).optional(),
  visibility: z.enum(Visibility).optional(),
});

const NotificationsFilterFieldsSchema = PaginationSchema.extend({
  isRead: z.boolean().optional(),
  repoName: z.string().trim().min(1).max(255).optional(),
  repoOwner: z.string().trim().min(1).max(39).optional(),
  type: z.enum(NotifyType).optional(),
});

function requireRepoIdentityPair<T extends { repoName?: string; repoOwner?: string }>(
  schema: z.ZodType<T>
) {
  return schema.refine(
    (value) =>
      (value.repoName == null && value.repoOwner == null) ||
      (value.repoName != null && value.repoOwner != null),
    {
      message: "repoName and repoOwner must be provided together",
      path: ["repoName"],
    }
  );
}

export const NotificationsFilterSchema = requireRepoIdentityPair(NotificationsFilterFieldsSchema);

export const NotificationsBulkFilterSchema = requireRepoIdentityPair(
  NotificationsFilterFieldsSchema.omit({ cursor: true, isRead: true, limit: true }).partial()
);

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
