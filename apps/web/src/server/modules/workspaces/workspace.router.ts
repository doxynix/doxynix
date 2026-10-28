import * as z from "zod";

import { createTRPCRouter, protectedProcedure, workspaceProcedure } from "@/server/core/trpc/init";

import {
  AddWorkspaceMemberSchema,
  RemoveWorkspaceMemberSchema,
  SwitchWorkspaceSchema,
  WorkspaceMemberSummarySchema,
  WorkspaceSummarySchema,
} from "./workspace.schemas";
import { workspaceService } from "./workspace.service";

export const workspaceRouter = createTRPCRouter({
  addMember: workspaceProcedure
    .input(AddWorkspaceMemberSchema)
    .output(WorkspaceMemberSummarySchema)
    .mutation(async ({ ctx, input }) => {
      return workspaceService.addMember(ctx.db, ctx.workspace.id, ctx.workspace.role, input.email);
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

  removeMember: workspaceProcedure
    .input(RemoveWorkspaceMemberSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await workspaceService.removeMember(
        ctx.db,
        ctx.workspace.id,
        ctx.workspace.role,
        input.userId,
      );

      return { success: true };
    }),

  switchWorkspace: protectedProcedure
    .input(SwitchWorkspaceSchema)
    .output(WorkspaceSummarySchema)
    .mutation(async ({ ctx, input }) => {
      return workspaceService.switchWorkspace(ctx.db, input.workspaceId, ctx.session.user.id);
    }),

  upgradeToPro: workspaceProcedure.output(WorkspaceSummarySchema).mutation(async ({ ctx }) => {
    return workspaceService.upgradeToPro(ctx.db, ctx.workspace.id, ctx.workspace.role);
  }),
});
