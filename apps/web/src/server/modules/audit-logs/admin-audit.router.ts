import * as z from "zod";

import { adminProcedure, createTRPCRouter } from "@/server/core/trpc/init";

import {
  AdminAuditFilterSchema,
  AdminAuditListSchema,
  AdminAuditRefSchema,
} from "./admin-audit.schemas";
import { adminAuditService } from "./admin-audit.service";
import { AuditLogSchema } from "./audit-logs.schemas";

export const adminAuditRouter = createTRPCRouter({
  detail: adminProcedure
    .input(AdminAuditRefSchema)
    .output(AuditLogSchema)
    .query(async ({ ctx, input }) => {
      return adminAuditService.getDetail(ctx.db, input.id);
    }),

  list: adminProcedure
    .input(AdminAuditFilterSchema)
    .output(AdminAuditListSchema)
    .query(async ({ ctx, input }) => {
      return adminAuditService.getAll(ctx.db, input);
    }),

  payloadHtml: adminProcedure
    .input(AdminAuditRefSchema)
    .output(z.string())
    .query(async ({ ctx, input }) => {
      return adminAuditService.getPayloadHtml(ctx.db, input.id);
    }),
});
