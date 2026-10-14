import { PaginationMetaSchema, UserRoleSchema } from "@doxynix/shared";
import * as z from "zod";

import {
  DateRangeSchema,
  dateRangeMustBeOrdered,
  PaginationSchema,
} from "@/server/utils/pagination";

const BAN_REASON_MAX = 500;

export const AdminUsersFilterSchema = PaginationSchema.extend({
  banned: z.boolean().optional(),
  role: z.optional(UserRoleSchema),
  ...DateRangeSchema.shape,
}).superRefine(dateRangeMustBeOrdered);

export type AdminUsersFilterInput = z.infer<typeof AdminUsersFilterSchema>;

export const AdminUserRefSchema = z.object({ id: z.uuid() });

export type AdminUserRefInput = z.infer<typeof AdminUserRefSchema>;

export const AdminSetRoleSchema = z.object({ id: z.uuid(), role: UserRoleSchema });

export type AdminSetRoleInput = z.infer<typeof AdminSetRoleSchema>;

export const AdminSetBannedSchema = z
  .object({
    banExpires: z.coerce.date().optional(),
    banned: z.boolean(),
    banReason: z.string().trim().max(BAN_REASON_MAX).optional(),
    code: z.string().trim().optional(),
    id: z.uuid(),
  })
  .refine((data) => data.banned || (data.banReason == null && data.banExpires == null), {
    message: "A ban reason and an expiry only apply while a user is banned",
    path: ["banned"],
  })
  .refine((data) => !data.banned || data.code != null, {
    message: "Banning a user requires a confirmation code",
    path: ["code"],
  });

export type AdminSetBannedInput = z.infer<typeof AdminSetBannedSchema>;

export const AdminDeleteUserSchema = AdminUserRefSchema.extend({
  code: z.string().trim().optional(),
});

export type AdminDeleteUserInput = z.infer<typeof AdminDeleteUserSchema>;

export const AdminUserCountsSchema = z.object({
  apiKeys: z.number().int().min(0),
  chatSessions: z.number().int().min(0),
  notifications: z.number().int().min(0),
  repos: z.number().int().min(0),
  sessions: z.number().int().min(0),
});

export const AdminUserSummarySchema = z.object({
  banExpires: z.date().nullable(),
  banned: z.boolean(),
  banReason: z.string().nullable(),
  createdAt: z.date(),
  email: z.email().nullable(),
  emailVerified: z.boolean(),
  id: z.uuid(),
  image: z.string().nullable(),
  lastLoginMethod: z.string().nullable(),
  name: z.string().nullable(),
  role: UserRoleSchema,
  twoFactorEnabled: z.boolean(),
  updatedAt: z.date(),
});

export type AdminUserSummary = z.infer<typeof AdminUserSummarySchema>;

export const AdminUserDetailSchema = AdminUserSummarySchema.extend({
  counts: AdminUserCountsSchema,
});

export type AdminUserDetail = z.infer<typeof AdminUserDetailSchema>;

export const AdminUsersListSchema = z.object({
  items: z.array(AdminUserSummarySchema),
  meta: PaginationMetaSchema,
});

export const AdminUserSessionSchema = z.object({
  createdAt: z.date(),
  expired: z.boolean(),
  expiresAt: z.date(),
  id: z.uuid(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
});

export const AdminUserSessionsListSchema = z.object({
  items: z.array(AdminUserSessionSchema),
});

export const AdminUserSessionRefSchema = z.object({ sessionId: z.uuid() });
