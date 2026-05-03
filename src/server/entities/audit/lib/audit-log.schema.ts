import { z } from "zod";

export const AuditSeveritySchema = z.enum(["info", "warning", "error", "success"]);

export const DeviceTypeSchema = z.enum(["desktop", "mobile", "tablet", "system"]);

export const AuditDetailSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const AuditLogSchema = z.object({
  actionTitle: z.string(),
  browser: z.string(),
  createdAt: z.date(),
  details: z.array(AuditDetailSchema).nullable(),
  deviceType: DeviceTypeSchema,
  entityType: z.string(),
  iconKey: z.string(),
  id: z.string(),
  ip: z.string().nullable(),
  rawPayload: z.record(z.string(), z.any()),
  requestId: z.string().nullable(),
  severity: AuditSeveritySchema,
  targetName: z.string(),
});

export type AuditLogType = z.infer<typeof AuditLogSchema>;
export type AuditSeverityType = z.infer<typeof AuditSeveritySchema>;
