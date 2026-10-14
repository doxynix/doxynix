import type { RouterOutput } from "@/shared/api/trpc";

export type AdminAuditEntry = RouterOutput["adminAudit"]["list"]["items"][number];
