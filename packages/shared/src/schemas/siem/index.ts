import * as z from "zod";

export const SeveritySchema = z.enum(["critical", "high", "low", "medium"]);

export type SiemSeverity = z.infer<typeof SeveritySchema>;

export const SiemUserRoleSchema = z.enum(["admin", "analyst"]);

export type SiemUserRole = z.infer<typeof SiemUserRoleSchema>;

export const SiemPaginationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  page: z.coerce.number().int().positive().default(1),
});

export type SiemPaginationQuery = z.infer<typeof SiemPaginationQuerySchema>;

export const SiemPaginationMetaSchema = z.object({
  limit: z.number().int().positive(),
  page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export type SiemPaginationMeta = z.infer<typeof SiemPaginationMetaSchema>;

export function siemPaginatedSchema<TItem extends z.ZodType>(item: TItem) {
  return z.object({
    items: z.array(item),
    pagination: SiemPaginationMetaSchema,
  });
}

export const FindingSchema = z.object({
  id: z.uuid(),
  incidentId: z.uuid(),
  line: z.number().int().nonnegative(),
  matchedText: z.string(),
  ruleName: z.string().max(100),
  severity: SeveritySchema,
});

export type Finding = z.infer<typeof FindingSchema>;

export const IncidentSchema = z.object({
  createdAt: z.coerce.date(),
  fileName: z.string().max(255),
  findingsCount: z.number().int().nonnegative(),
  id: z.uuid(),
  score: z.number().int(),
  severity: SeveritySchema,
});

export type Incident = z.infer<typeof IncidentSchema>;

export const IncidentDetailSchema = IncidentSchema.extend({
  findings: z.array(FindingSchema),
});

export type IncidentDetail = z.infer<typeof IncidentDetailSchema>;

export const IncidentsQuerySchema = SiemPaginationQuerySchema.extend({
  fileName: z.string().max(255).optional(),
  severity: SeveritySchema.optional(),
});

export type IncidentsQuery = z.infer<typeof IncidentsQuerySchema>;

export const IncidentParamsSchema = z.object({
  id: z.uuid("Invalid incident ID format"),
});

export type IncidentParams = z.infer<typeof IncidentParamsSchema>;

export const IncidentListSchema = siemPaginatedSchema(IncidentSchema);

export type IncidentList = z.infer<typeof IncidentListSchema>;

export const AuditLogSchema = z.object({
  action: z.string().max(150),
  actor: z.string().max(100),
  country: z.string().max(10),
  createdAt: z.coerce.date(),
  id: z.uuid(),
  ipAddress: z.string(),
  requestId: z.string().max(100).nullable(),
  target: z.string().max(150),
  userAgent: z.string().nullable(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

export const AuditLogsQuerySchema = SiemPaginationQuerySchema.extend({
  action: z.string().max(150).optional(),
  actor: z.string().max(100).optional(),
});

export type AuditLogsQuery = z.infer<typeof AuditLogsQuerySchema>;

export const AuditLogListSchema = siemPaginatedSchema(AuditLogSchema);

export type AuditLogList = z.infer<typeof AuditLogListSchema>;

export const RuleSchema = z.object({
  createdAt: z.coerce.date(),
  description: z.string(),
  id: z.uuid(),
  isActive: z.boolean(),
  name: z.string(),
  pattern: z.string(),
  severity: SeveritySchema,
});

export type Rule = z.infer<typeof RuleSchema>;

export const RulesQuerySchema = SiemPaginationQuerySchema.extend({
  isActive: z.coerce.boolean().optional(),
  search: z.string().max(255, "Search query too long").optional(),
  severity: SeveritySchema.optional(),
});

export type RulesQuery = z.infer<typeof RulesQuerySchema>;

function isValidRegex(pattern: string): boolean {
  try {
    return new RegExp(pattern) instanceof RegExp;
  } catch {
    return false;
  }
}

export const CreateRuleSchema = z.object({
  description: z.string().min(5).max(1000),
  isActive: z.boolean().default(true),
  name: z.string().min(3).max(100),
  pattern: z.string().min(1).max(2000).refine(isValidRegex, "Invalid regex"),
  severity: SeveritySchema,
});

export type CreateRule = z.infer<typeof CreateRuleSchema>;

export const UpdateRuleSchema = CreateRuleSchema.partial();

export type UpdateRule = z.infer<typeof UpdateRuleSchema>;

export const RuleParamsSchema = z.object({
  id: z.uuid("Invalid rule ID format"),
});

export type RuleParams = z.infer<typeof RuleParamsSchema>;

export const RuleListSchema = siemPaginatedSchema(RuleSchema);

export type RuleList = z.infer<typeof RuleListSchema>;

export const DashboardAnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(90).default(7),
});

export type DashboardAnalyticsQuery = z.infer<typeof DashboardAnalyticsQuerySchema>;

export const DashboardAnalyticsSchema = z.object({
  kpis: z.object({
    activeRules: z.number().int().nonnegative(),
    criticalIncidents: z.number().int().nonnegative(),
    totalFindings: z.number().int().nonnegative(),
    totalIncidents: z.number().int().nonnegative(),
  }),
  recentIncidents: z.array(IncidentSchema),
  severityBreakdown: z.array(
    z.object({
      count: z.number().int().nonnegative(),
      severity: SeveritySchema,
    }),
  ),
});

export type DashboardAnalytics = z.infer<typeof DashboardAnalyticsSchema>;

const MAX_LOG_SIZE_CHARS = 2 * 1024 * 1024;

export const ScanRequestSchema = z.object({
  content: z
    .string()
    .min(1, "Log content cannot be empty")
    .max(MAX_LOG_SIZE_CHARS, "Log content exceeds maximum allowed size (2MB)"),
  fileName: z
    .string()
    .max(255, "File name must not exceed 255 characters")
    .default("manual_scan.log"),
});

export type ScanRequest = z.infer<typeof ScanRequestSchema>;

export const LeakFindingSchema = z.object({
  line: z.number().int().nonnegative(),
  matchedText: z.string(),
  ruleId: z.uuid(),
  ruleName: z.string(),
  severity: SeveritySchema,
});

export type LeakFinding = z.infer<typeof LeakFindingSchema>;

export const ScanResultSchema = z.object({
  findings: z.array(LeakFindingSchema).optional(),
  isSafe: z.boolean(),
  message: z.string(),
});

export type ScanResult = z.infer<typeof ScanResultSchema>;

export const StreamLogEntrySchema = z.object({
  message: z.string(),
  timestamp: z.string(),
});

export type StreamLogEntry = z.infer<typeof StreamLogEntrySchema>;

export const StreamLogEventSchema = z.enum(["log", "ping"]);

export type StreamLogEvent = z.infer<typeof StreamLogEventSchema>;
