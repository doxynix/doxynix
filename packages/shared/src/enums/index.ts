// This file was automatically generated via Prisma DMMF. DO NOT EDIT MANUALLY.
import * as z from "zod/mini";

// ------------------- UserRole -------------------
export const UserRoleSchema = z.enum(["ADMIN", "USER"]);
export type UserRole = z.infer<typeof UserRoleSchema>;
export const UserRole = {
  ADMIN: "ADMIN",
  USER: "USER",
} as const;

// ------------------- OnboardingIntent -------------------
export const OnboardingIntentSchema = z.enum(["ARCHITECTURE", "DOCUMENTATION", "RISKS"]);
export type OnboardingIntent = z.infer<typeof OnboardingIntentSchema>;
export const OnboardingIntent = {
  ARCHITECTURE: "ARCHITECTURE",
  DOCUMENTATION: "DOCUMENTATION",
  RISKS: "RISKS",
} as const;

// ------------------- BannedEmailReason -------------------
export const BannedEmailReasonSchema = z.enum([
  "BOUNCED",
  "COMPLAINED",
  "DISPOSABLE",
  "FAILED",
  "MANUAL",
  "SUPPRESSED",
]);
export type BannedEmailReason = z.infer<typeof BannedEmailReasonSchema>;
export const BannedEmailReason = {
  BOUNCED: "BOUNCED",
  COMPLAINED: "COMPLAINED",
  DISPOSABLE: "DISPOSABLE",
  FAILED: "FAILED",
  MANUAL: "MANUAL",
  SUPPRESSED: "SUPPRESSED",
} as const;

// ------------------- Visibility -------------------
export const VisibilitySchema = z.enum(["PRIVATE", "PUBLIC"]);
export type Visibility = z.infer<typeof VisibilitySchema>;
export const Visibility = {
  PRIVATE: "PRIVATE",
  PUBLIC: "PUBLIC",
} as const;

// ------------------- InstallationTargetType -------------------
export const InstallationTargetTypeSchema = z.enum(["ORGANIZATION", "USER"]);
export type InstallationTargetType = z.infer<typeof InstallationTargetTypeSchema>;
export const InstallationTargetType = {
  ORGANIZATION: "ORGANIZATION",
  USER: "USER",
} as const;

// ------------------- RepositorySelection -------------------
export const RepositorySelectionSchema = z.enum(["ALL", "SELECTED"]);
export type RepositorySelection = z.infer<typeof RepositorySelectionSchema>;
export const RepositorySelection = {
  ALL: "ALL",
  SELECTED: "SELECTED",
} as const;

// ------------------- WorkspaceRole -------------------
export const WorkspaceRoleSchema = z.enum(["MEMBER", "OWNER"]);
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;
export const WorkspaceRole = {
  MEMBER: "MEMBER",
  OWNER: "OWNER",
} as const;

// ------------------- AccessState -------------------
export const AccessStateSchema = z.enum([
  "ACTIVE",
  "CANCELED",
  "GRACE",
  "NO_SUBSCRIPTION",
  "PENDING",
  "REVIEW",
  "SUSPENDED",
]);
export type AccessState = z.infer<typeof AccessStateSchema>;
export const AccessState = {
  ACTIVE: "ACTIVE",
  CANCELED: "CANCELED",
  GRACE: "GRACE",
  NO_SUBSCRIPTION: "NO_SUBSCRIPTION",
  PENDING: "PENDING",
  REVIEW: "REVIEW",
  SUSPENDED: "SUSPENDED",
} as const;

// ------------------- ApiKeyScope -------------------
export const ApiKeyScopeSchema = z.enum(["CLI", "FULL", "MCP"]);
export type ApiKeyScope = z.infer<typeof ApiKeyScopeSchema>;
export const ApiKeyScope = {
  CLI: "CLI",
  FULL: "FULL",
  MCP: "MCP",
} as const;

// ------------------- BillingEventStatus -------------------
export const BillingEventStatusSchema = z.enum([
  "DEAD_LETTER",
  "ENQUEUED",
  "PROCESSED",
  "PROCESSING",
  "RECEIVED",
]);
export type BillingEventStatus = z.infer<typeof BillingEventStatusSchema>;
export const BillingEventStatus = {
  DEAD_LETTER: "DEAD_LETTER",
  ENQUEUED: "ENQUEUED",
  PROCESSED: "PROCESSED",
  PROCESSING: "PROCESSING",
  RECEIVED: "RECEIVED",
} as const;

// ------------------- BillingOperationStatus -------------------
export const BillingOperationStatusSchema = z.enum(["COMPLETED", "FAILED", "STARTED"]);
export type BillingOperationStatus = z.infer<typeof BillingOperationStatusSchema>;
export const BillingOperationStatus = {
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  STARTED: "STARTED",
} as const;

// ------------------- BillingReconciliationStatus -------------------
export const BillingReconciliationStatusSchema = z.enum(["FAILED", "RUNNING", "SUCCESS"]);
export type BillingReconciliationStatus = z.infer<typeof BillingReconciliationStatusSchema>;
export const BillingReconciliationStatus = {
  FAILED: "FAILED",
  RUNNING: "RUNNING",
  SUCCESS: "SUCCESS",
} as const;

// ------------------- BillingIssueStatus -------------------
export const BillingIssueStatusSchema = z.enum(["OPEN", "RESOLVED"]);
export type BillingIssueStatus = z.infer<typeof BillingIssueStatusSchema>;
export const BillingIssueStatus = {
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
} as const;

// ------------------- BillingIssueSeverity -------------------
export const BillingIssueSeveritySchema = z.enum(["CRITICAL", "INFO", "WARNING"]);
export type BillingIssueSeverity = z.infer<typeof BillingIssueSeveritySchema>;
export const BillingIssueSeverity = {
  CRITICAL: "CRITICAL",
  INFO: "INFO",
  WARNING: "WARNING",
} as const;

// ------------------- UsageEventKind -------------------
export const UsageEventKindSchema = z.enum([
  "ANALYSIS",
  "ANALYSIS_RELEASE",
  "CACHE_HIT",
  "RESERVE",
  "SETTLE",
]);
export type UsageEventKind = z.infer<typeof UsageEventKindSchema>;
export const UsageEventKind = {
  ANALYSIS: "ANALYSIS",
  ANALYSIS_RELEASE: "ANALYSIS_RELEASE",
  CACHE_HIT: "CACHE_HIT",
  RESERVE: "RESERVE",
  SETTLE: "SETTLE",
} as const;

// ------------------- PRAnalysisStatus -------------------
export const PRAnalysisStatusSchema = z.enum(["ANALYZING", "COMPLETED", "FAILED", "PENDING"]);
export type PRAnalysisStatus = z.infer<typeof PRAnalysisStatusSchema>;
export const PRAnalysisStatus = {
  ANALYZING: "ANALYZING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  PENDING: "PENDING",
} as const;

// ------------------- FixStatus -------------------
export const FixStatusSchema = z.enum([
  "COMPLETED",
  "DRAFT",
  "FAILED",
  "GENERATING",
  "PR_OPENED",
  "READY_TO_APPLY",
]);
export type FixStatus = z.infer<typeof FixStatusSchema>;
export const FixStatus = {
  COMPLETED: "COMPLETED",
  DRAFT: "DRAFT",
  FAILED: "FAILED",
  GENERATING: "GENERATING",
  PR_OPENED: "PR_OPENED",
  READY_TO_APPLY: "READY_TO_APPLY",
} as const;

// ------------------- Status -------------------
export const StatusSchema = z.enum(["DONE", "FAILED", "NEW", "PENDING"]);
export type Status = z.infer<typeof StatusSchema>;
export const Status = {
  DONE: "DONE",
  FAILED: "FAILED",
  NEW: "NEW",
  PENDING: "PENDING",
} as const;

// ------------------- DocType -------------------
export const DocTypeSchema = z.enum([
  "API",
  "ARCHITECTURE",
  "CHANGELOG",
  "CODE_DOC",
  "CONTRIBUTING",
  "README",
]);
export type DocType = z.infer<typeof DocTypeSchema>;
export const DocType = {
  API: "API",
  ARCHITECTURE: "ARCHITECTURE",
  CHANGELOG: "CHANGELOG",
  CODE_DOC: "CODE_DOC",
  CONTRIBUTING: "CONTRIBUTING",
  README: "README",
} as const;

// ------------------- PRCommentStyle -------------------
export const PRCommentStyleSchema = z.enum(["CONCISE", "DETAILED", "OFF"]);
export type PRCommentStyle = z.infer<typeof PRCommentStyleSchema>;
export const PRCommentStyle = {
  CONCISE: "CONCISE",
  DETAILED: "DETAILED",
  OFF: "OFF",
} as const;

// ------------------- PRFocusArea -------------------
export const PRFocusAreaSchema = z.enum(["ARCHITECTURE", "PERFORMANCE", "SECURITY", "STYLE"]);
export type PRFocusArea = z.infer<typeof PRFocusAreaSchema>;
export const PRFocusArea = {
  ARCHITECTURE: "ARCHITECTURE",
  PERFORMANCE: "PERFORMANCE",
  SECURITY: "SECURITY",
  STYLE: "STYLE",
} as const;

// ------------------- AuditOperation -------------------
export const AuditOperationSchema = z.enum([
  "CREATE",
  "CREATE_MANY",
  "CREATE_MANY_AND_RETURN",
  "DELETE",
  "DELETE_MANY",
  "UPDATE",
  "UPDATE_MANY",
  "UPDATE_MANY_AND_RETURN",
  "UPSERT",
]);
export type AuditOperation = z.infer<typeof AuditOperationSchema>;
export const AuditOperation = {
  CREATE: "CREATE",
  CREATE_MANY: "CREATE_MANY",
  CREATE_MANY_AND_RETURN: "CREATE_MANY_AND_RETURN",
  DELETE: "DELETE",
  DELETE_MANY: "DELETE_MANY",
  UPDATE: "UPDATE",
  UPDATE_MANY: "UPDATE_MANY",
  UPDATE_MANY_AND_RETURN: "UPDATE_MANY_AND_RETURN",
  UPSERT: "UPSERT",
} as const;

// ------------------- AuditModel -------------------
export const AuditModelSchema = z.enum([
  "Account",
  "Analysis",
  "ApiKey",
  "BannedEmail",
  "ChatMessage",
  "ChatSession",
  "Document",
  "GeneratedFix",
  "GithubInstallation",
  "Notification",
  "Passkey",
  "PullRequestAnalysis",
  "PullRequestAnalysisConfig",
  "PullRequestComment",
  "Repo",
  "Session",
  "TwoFactor",
  "User",
  "Verification",
  "WebhookDelivery",
]);
export type AuditModel = z.infer<typeof AuditModelSchema>;
export const AuditModel = {
  Account: "Account",
  Analysis: "Analysis",
  ApiKey: "ApiKey",
  BannedEmail: "BannedEmail",
  ChatMessage: "ChatMessage",
  ChatSession: "ChatSession",
  Document: "Document",
  GeneratedFix: "GeneratedFix",
  GithubInstallation: "GithubInstallation",
  Notification: "Notification",
  Passkey: "Passkey",
  PullRequestAnalysis: "PullRequestAnalysis",
  PullRequestAnalysisConfig: "PullRequestAnalysisConfig",
  PullRequestComment: "PullRequestComment",
  Repo: "Repo",
  Session: "Session",
  TwoFactor: "TwoFactor",
  User: "User",
  Verification: "Verification",
  WebhookDelivery: "WebhookDelivery",
} as const;

// ------------------- NotifyType -------------------
export const NotifyTypeSchema = z.enum(["ERROR", "INFO", "SUCCESS", "WARNING"]);
export type NotifyType = z.infer<typeof NotifyTypeSchema>;
export const NotifyType = {
  ERROR: "ERROR",
  INFO: "INFO",
  SUCCESS: "SUCCESS",
  WARNING: "WARNING",
} as const;

// ------------------- WebhookStatus -------------------
export const WebhookStatusSchema = z.enum(["FAILED", "PROCESSING", "SUCCESS"]);
export type WebhookStatus = z.infer<typeof WebhookStatusSchema>;
export const WebhookStatus = {
  FAILED: "FAILED",
  PROCESSING: "PROCESSING",
  SUCCESS: "SUCCESS",
} as const;

// ------------------- ChatRole -------------------
export const ChatRoleSchema = z.enum(["assistant", "data", "system", "user"]);
export type ChatRole = z.infer<typeof ChatRoleSchema>;
export const ChatRole = {
  assistant: "assistant",
  data: "data",
  system: "system",
  user: "user",
} as const;
