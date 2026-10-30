import { createTRPCRouter, ownerProcedure } from "@/server/core/trpc/init";

import { createCheckoutSession } from "./billing.checkout";
import { changeSeats, previewPlanChange } from "./billing.plan-changes";
import {
  ChangeSeatsResultSchema,
  ChangeSeatsSchema,
  CreateCheckoutResultSchema,
  CreateCheckoutSchema,
  PlanChangeQuantitySchema,
  PreviewPlanChangeResultSchema,
} from "./billing.schemas";

export const billingRouter = createTRPCRouter({
  changeSeats: ownerProcedure
    .input(ChangeSeatsSchema)
    .output(ChangeSeatsResultSchema)
    .mutation(async ({ ctx, input }) => {
      return changeSeats({
        actorUserId: ctx.session.user.id,
        db: ctx.prisma,
        quantity: input.quantity,
        requestId: input.requestId,
        workspaceId: ctx.workspace.id,
      });
    }),
  createCheckout: ownerProcedure
    .input(CreateCheckoutSchema)
    .output(CreateCheckoutResultSchema)
    .mutation(async ({ ctx, input }) => {
      return createCheckoutSession({
        actorUserId: ctx.session.user.id,
        db: ctx.prisma,
        requestId: input.requestId,
        workspaceId: ctx.workspace.id,
      });
    }),

  previewPlanChange: ownerProcedure
    .input(PlanChangeQuantitySchema)
    .output(PreviewPlanChangeResultSchema)
    .mutation(async ({ ctx, input }) => {
      return previewPlanChange({
        actorUserId: ctx.session.user.id,
        db: ctx.prisma,
        quantity: input.quantity,
        workspaceId: ctx.workspace.id,
      });
    }),
});
