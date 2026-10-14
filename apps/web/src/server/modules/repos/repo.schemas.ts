import { Status, Visibility } from "@doxynix/shared";
import * as z from "zod";

import {
  CursorSchema,
  DateRangeSchema,
  dateRangeMustBeOrdered,
  PaginationSchema,
} from "@/server/utils/pagination";

export const RepoFilterSchema = PaginationSchema.extend({
  owner: z.string().trim().min(1).max(39).optional(),
  sortBy: z.enum(["name", "updatedAt", "createdAt"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(Status).optional(),
  visibility: z.enum(Visibility).optional(),
  ...DateRangeSchema.shape,
}).superRefine(dateRangeMustBeOrdered);

export type RepoFiltersInput = z.infer<typeof RepoFilterSchema>;

export const RepoSlimFilterSchema = CursorSchema.extend({
  owner: z.string().trim().min(1).max(39).optional(),
  status: z.enum(Status).optional(),
  visibility: z.enum(Visibility).optional(),
});

export type RepoSlimFiltersInput = z.infer<typeof RepoSlimFilterSchema>;
