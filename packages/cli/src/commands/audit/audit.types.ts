import type { RouterInput, RouterOutput } from "@/core/client";

export type AuditLogItem = RouterOutput["audit"]["getActivityLogs"]["items"][number];
export type AuditLogsResponse = RouterOutput["audit"]["getActivityLogs"];
export type AuditLogsQueryInput = RouterInput["audit"]["getActivityLogs"];
