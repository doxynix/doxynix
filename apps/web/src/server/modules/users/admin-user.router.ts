import type { NextRequest } from "next/server";
import * as z from "zod";

import { adminProcedure, createTRPCRouter } from "@/server/core/trpc/init";

import {
  AdminDeleteUserSchema,
  AdminSetBannedSchema,
  AdminSetRoleSchema,
  AdminUserDetailSchema,
  AdminUserRefSchema,
  AdminUserSessionRefSchema,
  AdminUserSessionsListSchema,
  AdminUserSummarySchema,
  AdminUsersFilterSchema,
  AdminUsersListSchema,
} from "./admin-user.schemas";
import { adminUserService, type ReauthInput } from "./admin-user.service";

function reauthFrom(ctx: {
  req: NextRequest;
  session: { user: { twoFactorEnabled?: boolean | null } };
}): ReauthInput {
  return {
    headers: ctx.req.headers,
    twoFactorEnabled: ctx.session.user.twoFactorEnabled === true,
  };
}

export const adminUserRouter = createTRPCRouter({
  deleteUser: adminProcedure
    .input(AdminDeleteUserSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return adminUserService.deleteUser(ctx.db, ctx.session.user.id, input, reauthFrom(ctx));
    }),

  getDetail: adminProcedure
    .input(AdminUserRefSchema)
    .output(AdminUserDetailSchema)
    .query(async ({ ctx, input }) => {
      return adminUserService.getDetail(ctx.db, input.id);
    }),

  list: adminProcedure
    .input(AdminUsersFilterSchema)
    .output(AdminUsersListSchema)
    .query(async ({ ctx, input }) => {
      return adminUserService.getAll(ctx.db, input);
    }),

  listSessions: adminProcedure
    .input(AdminUserRefSchema)
    .output(AdminUserSessionsListSchema)
    .query(async ({ ctx, input }) => {
      return adminUserService.getSessions(ctx.db, input.id);
    }),

  revokeSession: adminProcedure
    .input(AdminUserSessionRefSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return adminUserService.revokeSession(ctx.db, input.sessionId);
    }),

  setBanned: adminProcedure
    .input(AdminSetBannedSchema)
    .output(z.object({ user: AdminUserSummarySchema }))
    .mutation(async ({ ctx, input }) => {
      return adminUserService.setBanned(ctx.db, ctx.session.user.id, input, reauthFrom(ctx));
    }),

  setRole: adminProcedure
    .input(AdminSetRoleSchema)
    .output(z.object({ user: AdminUserSummarySchema }))
    .mutation(async ({ ctx, input }) => {
      return adminUserService.setRole(ctx.db, ctx.session.user.id, input);
    }),
});
