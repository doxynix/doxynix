import { adminProcedure, createTRPCRouter, ownerProcedure } from "@/server/core/trpc/init";

import { listBillingIssues, replayBillingEvent, resolveBillingIssue } from "./billing.admin";
import { createCheckoutSession } from "./billing.checkout";
import { changeSeats, previewPlanChange } from "./billing.plan-changes";
import { createPortalSession, portalReturnUrl } from "./billing.portal";
import {
  ChangeSeatsResultSchema,
  ChangeSeatsSchema,
  CreateCheckoutResultSchema,
  CreateCheckoutSchema,
  CreatePortalSessionSchema,
  ListIssuesResultSchema,
  ListIssuesSchema,
  PlanChangeQuantitySchema,
  PortalSessionResultSchema,
  PreviewPlanChangeResultSchema,
  ReplayEventResultSchema,
  ReplayEventSchema,
  ResolveIssueResultSchema,
  ResolveIssueSchema,
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

  createPortalSession: ownerProcedure
    .input(CreatePortalSessionSchema)
    .output(PortalSessionResultSchema)
    .mutation(async ({ ctx, input }) => {
      return createPortalSession({
        db: ctx.prisma,
        returnUrl: portalReturnUrl(input.returnPath ?? "/dashboard/settings/members"),
        workspaceId: ctx.workspace.id,
      });
    }),

  listIssues: adminProcedure
    .input(ListIssuesSchema)
    .output(ListIssuesResultSchema)
    .query(async ({ ctx, input }) => {
      return listBillingIssues(ctx.prisma, input);
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

  replayEvent: adminProcedure
    .input(ReplayEventSchema)
    .output(ReplayEventResultSchema)
    .mutation(async ({ ctx, input }) => {
      return replayBillingEvent(ctx.prisma, input);
    }),

  resolveIssue: adminProcedure
    .input(ResolveIssueSchema)
    .output(ResolveIssueResultSchema)
    .mutation(async ({ ctx, input }) => {
      return resolveBillingIssue(ctx.prisma, input);
    }),
});
