import { createTRPCRouter, ownerProcedure } from "@/server/core/trpc/init";

import { createCheckoutSession } from "./billing.checkout";
import { CreateCheckoutResultSchema, CreateCheckoutSchema } from "./billing.schemas";

export const billingRouter = createTRPCRouter({
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
});
