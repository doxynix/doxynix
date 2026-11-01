import { TRPCError } from "@trpc/server";
import * as z from "zod";

import { previewSeatAddition } from "@/server/core/billing/seat-preview";
import { memberAddLimiter } from "@/server/core/ratelimit";
import {
  createTRPCRouter,
  ownerProcedure,
  protectedProcedure,
  workspaceProcedure,
} from "@/server/core/trpc/init";

import {
  AddWorkspaceMemberSchema,
  RemoveWorkspaceMemberSchema,
  SeatAdditionPreviewSchema,
  SwitchWorkspaceSchema,
  WorkspaceMemberSummarySchema,
  WorkspaceSummarySchema,
} from "./workspace.schemas";
import { workspaceService } from "./workspace.service";

export const workspaceRouter = createTRPCRouter({
  addMember: ownerProcedure
    .input(AddWorkspaceMemberSchema)
    .output(WorkspaceMemberSummarySchema)
    .mutation(async ({ ctx, input }) => {
      const { success } = await memberAddLimiter.limit(`user:${ctx.session.user.id}`);

      if (!success) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "RATE_LIMITED" });
      }

      return workspaceService.addMember(ctx.db, ctx.workspace.id, input.email);
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
