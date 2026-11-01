import {
  adminProcedure,
  createTRPCRouter,
  ownerProcedure,
  workspaceProcedure,
} from "@/server/core/trpc/init";

import { listBillingIssues, replayBillingEvent, resolveBillingIssue } from "./billing.admin";
import { createCheckoutSession } from "./billing.checkout";
import { createPortalSession, portalReturnUrl } from "./billing.portal";
import {
  BillingStateSchema,
  CreateCheckoutResultSchema,
  CreateCheckoutSchema,
  CreatePortalSessionSchema,
  ListIssuesResultSchema,
  ListIssuesSchema,
  PortalSessionResultSchema,
  ReplayEventResultSchema,
  ReplayEventSchema,
  ResolveIssueResultSchema,
  ResolveIssueSchema,
} from "./billing.schemas";
import { getBillingState } from "./billing.view";

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

  createPortalSession: ownerProcedure
    .input(CreatePortalSessionSchema)
    .output(PortalSessionResultSchema)
    .mutation(async ({ ctx, input }) => {
      return createPortalSession({
        db: ctx.prisma,
        requestId: input.requestId,
        returnUrl: portalReturnUrl(input.returnPath ?? "/dashboard/settings/members"),
        workspaceId: ctx.workspace.id,
      });
    }),

  getState: workspaceProcedure.output(BillingStateSchema).query(async ({ ctx }) => {
    return getBillingState(ctx.prisma, ctx.workspace.id);
  }),

  listIssues: adminProcedure
    .input(ListIssuesSchema)
    .output(ListIssuesResultSchema)
    .query(async ({ ctx, input }) => {
      return listBillingIssues(ctx.prisma, input);
    }),

  replayEvent: adminProcedure
    .input(ReplayEventSchema)
    .output(ReplayEventResultSchema)
    .mutation(async ({ ctx, input }) => {
      return replayBillingEvent(ctx.prisma, {
        ...input,
        actorUserId: ctx.session.user.id,
      });
    }),

  resolveIssue: adminProcedure
    .input(ResolveIssueSchema)
    .output(ResolveIssueResultSchema)
    .mutation(async ({ ctx, input }) => {
      return resolveBillingIssue(ctx.prisma, {
        ...input,
        actorUserId: ctx.session.user.id,
      });
    }),
});
