import { Status, Visibility } from "@prisma/client";
import { z } from "zod";

export const PaginationSchema = z.object({
  cursor: z.coerce.number().min(1).max(1000000).nullish(),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().max(1000).optional(),
});

export const RepoFilterSchema = PaginationSchema.extend({
  owner: z.string().optional(),
  sortBy: z.enum(["name", "updatedAt", "createdAt"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(Status).optional(),
  visibility: z.enum(Visibility).optional(),
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
