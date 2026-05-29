import { Status, Visibility } from "@prisma/client";
import { z } from "zod";

import { PaginationSchema } from "@/server/utils/pagination";

export const RepoFilterSchema = PaginationSchema.extend({
  owner: z.string().trim().min(1).max(39).optional(),
  sortBy: z.enum(["name", "updatedAt", "createdAt"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(Status).optional(),
  visibility: z.enum(Visibility).optional(),
});

export type RepoFiltersInput = z.infer<typeof RepoFilterSchema>;
