import { Status, Visibility } from "@prisma/client";
import { z } from "zod";

export const PaginationSchema = z.object({
  cursor: z.coerce.number().min(1).max(1000000).nullish().catch(null),
  limit: z.coerce.number().min(1).max(100).default(10).catch(10),
  search: z.string().optional(),
});

export const RepoFilterSchema = PaginationSchema.extend({
  owner: z.string().optional().catch(undefined),
  status: z.enum(Status).optional().catch(undefined),
  visibility: z.enum(Visibility).optional().catch(undefined),
  sortBy: z.enum(["name", "updatedAt", "createdAt"]).default("updatedAt").catch("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc").catch("desc"),
});

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
