import { MessageCode } from "@doxynix/shared";
import * as z from "zod";

import { AppError } from "@/server/core/api-error";
import { previewSeatAddition } from "@/server/core/billing/seat-preview";
import { memberAddLimiter } from "@/server/core/ratelimit";
import {
  createTRPCRouter,
  ownerProcedure,
  protectedProcedure,
  publicProcedure,
  workspaceProcedure,
} from "@/server/core/trpc/init";
import { REDIS_CONFIG } from "@/server/utils/redis";

import {
  AddWorkspaceMemberSchema,
  CreateWorkspaceInviteSchema,
  RemoveWorkspaceMemberSchema,
  SeatAdditionPreviewSchema,
  SwitchWorkspaceSchema,
  WorkspaceInviteAcceptedSchema,
  WorkspaceInviteCreatedSchema,
  WorkspaceInvitePreviewSchema,
  WorkspaceInviteTokenSchema,
  WorkspaceMemberSummarySchema,
  WorkspaceSummarySchema,
} from "./workspace.schemas";
import { workspaceService } from "./workspace.service";

export const workspaceRouter = createTRPCRouter({
  acceptInvite: protectedProcedure
    .input(WorkspaceInviteTokenSchema)
    .output(WorkspaceInviteAcceptedSchema)
    .mutation(async ({ ctx, input }) => {
      return workspaceService.acceptInvite(input.token, ctx.session.user.id);
    }),
  addMember: ownerProcedure
    .input(AddWorkspaceMemberSchema)
    .output(WorkspaceMemberSummarySchema)
    .mutation(async ({ ctx, input }) => {
      const { success } = await memberAddLimiter.limit(
        REDIS_CONFIG.rateLimit.user(ctx.session.user.id),
      );

      if (!success) {
        throw new AppError({
          code: "TOO_MANY_REQUESTS",
          messageCode: MessageCode.MEMBER_RATE_LIMITED,
          publicMessage: "RATE_LIMITED",
        });
      }

      return workspaceService.addMember(ctx.db, ctx.workspace.id, input.email);
    }),

  createInvite: ownerProcedure
    .input(CreateWorkspaceInviteSchema)
    .output(WorkspaceInviteCreatedSchema)
    .mutation(async ({ ctx, input }) => {
      const { success } = await memberAddLimiter.limit(
        REDIS_CONFIG.rateLimit.user(ctx.session.user.id),
      );

      if (!success) {
        throw new AppError({
          code: "TOO_MANY_REQUESTS",
          messageCode: MessageCode.MEMBER_RATE_LIMITED,
          publicMessage: "RATE_LIMITED",
        });
      }

      return workspaceService.createInvite(ctx.workspace.id, ctx.session.user.id, {
        email: input.email,
        inviterName: ctx.session.user.name,
      });
    }),

  members: workspaceProcedure
    .output(z.object({ items: z.array(WorkspaceMemberSummarySchema) }))
    .query(async ({ ctx }) => {
      const items = await workspaceService.listMembers(ctx.db, ctx.workspace.id);

      return { items };
    }),

  myWorkspaces: protectedProcedure
    .output(
      z.object({
        activeWorkspaceId: z.uuid(),
        items: z.array(WorkspaceSummarySchema),
        reset: z.boolean(),
      }),
    )
    .query(async ({ ctx }) => {
      return workspaceService.listForUser(
        ctx.db,
        ctx.session.user.id,
        ctx.req.headers.get("x-workspace-id"),
        ctx.session.user.name,
      );
    }),

  previewInvite: publicProcedure
    .input(WorkspaceInviteTokenSchema)
    .output(WorkspaceInvitePreviewSchema)
    .query(async ({ input }) => {
      return workspaceService.previewInvite(input.token);
    }),

  removeMember: ownerProcedure
    .input(RemoveWorkspaceMemberSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await workspaceService.removeMember(ctx.db, ctx.workspace.id, input.userId);

      return { success: true };
    }),

  // A seat is a paid resource: the owner sees the price before the person is saved.
  seatPreview: ownerProcedure
    .output(SeatAdditionPreviewSchema)
    .query(async ({ ctx }) => previewSeatAddition({ db: ctx.db, workspaceId: ctx.workspace.id })),

  switchWorkspace: protectedProcedure
    .input(SwitchWorkspaceSchema)
    .output(WorkspaceSummarySchema)
    .mutation(async ({ ctx, input }) => {
      return workspaceService.switchWorkspace(ctx.db, input.workspaceId, ctx.session.user.id);
    }),
});
