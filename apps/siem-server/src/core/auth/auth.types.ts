import type { auth } from "@server/core/auth/auth";
import type { rolesEnum } from "@server/core/db/schema";

export type UserRole = (typeof rolesEnum.enumValues)[number];

export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSession = typeof auth.$Infer.Session.session;
