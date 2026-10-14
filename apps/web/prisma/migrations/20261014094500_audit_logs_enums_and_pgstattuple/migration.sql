-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgstattuple";

-- CreateEnum
CREATE TYPE "AuditOperation" AS ENUM ('create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert', 'delete', 'deleteMany');

-- CreateEnum
CREATE TYPE "AuditModel" AS ENUM ('Account', 'Analysis', 'ApiKey', 'BannedEmail', 'ChatMessage', 'ChatSession', 'Document', 'GeneratedFix', 'GithubInstallation', 'Notification', 'Passkey', 'PullRequestAnalysis', 'PullRequestAnalysisConfig', 'PullRequestComment', 'Repo', 'Session', 'TwoFactor', 'User', 'Verification', 'WebhookDelivery');

-- This model was renamed; normalising first makes an unmapped legacy value fail the
-- migration loudly instead of silently dropping rows.
UPDATE "audit_logs" SET "model" = 'PullRequestAnalysisConfig' WHERE "model" = 'PrAnalysisConfig';

-- A benchmark script wrote this one operation in upper case. Any other unmapped value
-- still aborts the migration rather than being guessed at.
UPDATE "audit_logs" SET "operation" = 'create' WHERE "operation" = 'CREATE';

-- AlterTable
-- Prisma's own diff emits DROP/ADD COLUMN here, which would discard every row.
-- PostgreSQL rebuilds the dependent indexes automatically.
ALTER TABLE "audit_logs"
  ALTER COLUMN "model" TYPE "AuditModel" USING "model"::"AuditModel",
  ALTER COLUMN "operation" TYPE "AuditOperation" USING "operation"::"AuditOperation";