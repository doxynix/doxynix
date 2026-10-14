import type { UserRole } from "@doxynix/shared";

import type { RouterOutput } from "@/shared/api/trpc";

export type AdminUser = RouterOutput["adminUser"]["list"]["items"][number];

export type AdminUserDetail = RouterOutput["adminUser"]["getDetail"];

export type LinkedAccounts = RouterOutput["user"]["getLinkedAccounts"]["accounts"];

export type LinkedUser = RouterOutput["user"]["getLinkedAccounts"]["user"];

export type AdminUserRole = UserRole;
