import { adminProcedure, createTRPCRouter } from "@/server/core/trpc/init";

import {
  AdminReviewDetailSchema,
  AdminReviewFilterSchema,
  AdminReviewListSchema,
  AdminReviewRefSchema,
} from "./admin-review.schemas";
import { adminReviewService } from "./admin-review.service";

export const adminReviewRouter = createTRPCRouter({
  detail: adminProcedure
    .input(AdminReviewRefSchema)
    .output(AdminReviewDetailSchema)
    .query(async ({ ctx, input }) => {
      return adminReviewService.getDetail(ctx.db, input.id);
    }),

  list: adminProcedure
    .input(AdminReviewFilterSchema)
    .output(AdminReviewListSchema)
    .query(async ({ ctx, input }) => {
      return adminReviewService.getAll(ctx.db, input);
    }),
});
