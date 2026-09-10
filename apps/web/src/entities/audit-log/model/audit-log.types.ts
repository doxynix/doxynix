import type { RouterOutput } from "@/shared/api/trpc";

export type UiAuditLog = RouterOutput["audit"]["getActivityLogs"]["items"][number];
