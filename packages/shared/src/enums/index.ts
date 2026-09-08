// This file was automatically generated via Prisma DMMF. DO NOT EDIT MANUALLY.
import * as z from "zod/mini";

// ------------------- UserRole -------------------
export const UserRoleSchema = z.enum(["USER", "ADMIN"]);
export type UserRole = z.infer<typeof UserRoleSchema>;
export const UserRole = {
  ADMIN: "ADMIN",
  USER: "USER",
} as const;

// ------------------- BannedEmailReason -------------------
export const BannedEmailReasonSchema = z.enum([
  "BOUNCED",
  "COMPLAINED",
  "SUPPRESSED",
  "FAILED",
  "DISPOSABLE",
  "MANUAL",
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
export const VisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);
export type Visibility = z.infer<typeof VisibilitySchema>;
export const Visibility = {
  PRIVATE: "PRIVATE",
  PUBLIC: "PUBLIC",
} as const;

// ------------------- InstallationTargetType -------------------
export const InstallationTargetTypeSchema = z.enum(["USER", "ORGANIZATION"]);
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

// ------------------- PRAnalysisStatus -------------------
export const PRAnalysisStatusSchema = z.enum(["PENDING", "ANALYZING", "COMPLETED", "FAILED"]);
export type PRAnalysisStatus = z.infer<typeof PRAnalysisStatusSchema>;
export const PRAnalysisStatus = {
  ANALYZING: "ANALYZING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  PENDING: "PENDING",
} as const;

// ------------------- FixStatus -------------------
export const FixStatusSchema = z.enum([
  "DRAFT",
  "GENERATING",
  "READY_TO_APPLY",
  "PR_OPENED",
  "COMPLETED",
  "FAILED",
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
export const StatusSchema = z.enum(["PENDING", "DONE", "FAILED", "NEW"]);
export type Status = z.infer<typeof StatusSchema>;
export const Status = {
  DONE: "DONE",
  FAILED: "FAILED",
  NEW: "NEW",
  PENDING: "PENDING",
} as const;

// ------------------- DocType -------------------
export const DocTypeSchema = z.enum([
  "README",
  "API",
  "CONTRIBUTING",
  "CHANGELOG",
  "CODE_DOC",
  "ARCHITECTURE",
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
export const PRFocusAreaSchema = z.enum(["SECURITY", "PERFORMANCE", "ARCHITECTURE", "STYLE"]);
export type PRFocusArea = z.infer<typeof PRFocusAreaSchema>;
export const PRFocusArea = {
  ARCHITECTURE: "ARCHITECTURE",
  PERFORMANCE: "PERFORMANCE",
  SECURITY: "SECURITY",
  STYLE: "STYLE",
} as const;

// ------------------- NotifyType -------------------
export const NotifyTypeSchema = z.enum(["ERROR", "WARNING", "INFO", "SUCCESS"]);
export type NotifyType = z.infer<typeof NotifyTypeSchema>;
export const NotifyType = {
  ERROR: "ERROR",
  INFO: "INFO",
  SUCCESS: "SUCCESS",
  WARNING: "WARNING",
} as const;

// ------------------- WebhookStatus -------------------
export const WebhookStatusSchema = z.enum(["PROCESSING", "SUCCESS", "FAILED"]);
export type WebhookStatus = z.infer<typeof WebhookStatusSchema>;
export const WebhookStatus = {
  FAILED: "FAILED",
  PROCESSING: "PROCESSING",
  SUCCESS: "SUCCESS",
} as const;

// ------------------- ChatRole -------------------
export const ChatRoleSchema = z.enum(["user", "assistant", "system", "data"]);
export type ChatRole = z.infer<typeof ChatRoleSchema>;
export const ChatRole = {
  assistant: "assistant",
  data: "data",
  system: "system",
  user: "user",
} as const;
