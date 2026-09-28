-- DESTRUCTIVE: this migration drops and recreates every primary key column.
--
-- `id` is removed and re-added as UUID, so every pre-existing row receives a
-- brand new key and every foreign key that pointed at the old value is left
-- dangling. The 19 DropForeignKey / 19 AddForeignKey pairs therefore re-point at
-- empty tables.
--
-- This is only correct on a database with no application data. On a populated
-- database it either fails on the AddForeignKey constraint or silently orphans
-- every child row.
--
-- Verify emptiness before running:
--   SELECT (SELECT count(*) FROM users) + (SELECT count(*) FROM repos)
--        + (SELECT count(*) FROM analyses) + (SELECT count(*) FROM documents);
--
-- On a populated database the keys must be migrated instead, per table:
-- add a UUID column, backfill, drop the FK constraints, swap the primary key,
-- re-point the children, then re-add the constraints. Prisma does not generate
-- that migration; it only generates the destructive form above.

-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_user_id_fkey";

-- DropForeignKey
ALTER TABLE "analyses" DROP CONSTRAINT "analyses_repo_id_fkey";

-- DropForeignKey
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_user_id_fkey";

-- DropForeignKey
ALTER TABLE "chat_sessions" DROP CONSTRAINT "chat_sessions_repo_id_fkey";

-- DropForeignKey
ALTER TABLE "chat_sessions" DROP CONSTRAINT "chat_sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_analysis_id_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_repo_id_fkey";

-- DropForeignKey
ALTER TABLE "generated_fixes" DROP CONSTRAINT "generated_fixes_pr_analysis_id_fkey";

-- DropForeignKey
ALTER TABLE "generated_fixes" DROP CONSTRAINT "generated_fixes_repo_id_fkey";

-- DropForeignKey
ALTER TABLE "github_installations" DROP CONSTRAINT "github_installations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_repo_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "passkeys" DROP CONSTRAINT "passkeys_user_id_fkey";

-- DropForeignKey
ALTER TABLE "pr_analysis_configs" DROP CONSTRAINT "pr_analysis_configs_repo_id_fkey";

-- DropForeignKey
ALTER TABLE "pull_request_analyses" DROP CONSTRAINT "pull_request_analyses_repo_id_fkey";

-- DropForeignKey
ALTER TABLE "pull_request_comments" DROP CONSTRAINT "pull_request_comments_analysis_id_fkey";

-- DropForeignKey
ALTER TABLE "repos" DROP CONSTRAINT "repos_user_id_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "two_factors" DROP CONSTRAINT "two_factors_user_id_fkey";

-- DropIndex
DROP INDEX "accounts_public_id_key";

-- DropIndex
DROP INDEX "analyses_public_id_key";

-- DropIndex
DROP INDEX "documents_public_id_key";

-- DropIndex
DROP INDEX "generated_fixes_public_id_key";

-- DropIndex
DROP INDEX "notifications_public_id_key";

-- DropIndex
DROP INDEX "pr_analysis_configs_public_id_key";

-- DropIndex
DROP INDEX "pull_request_analyses_public_id_key";

-- DropIndex
DROP INDEX "pull_request_comments_public_id_key";

-- DropIndex
DROP INDEX "repos_public_id_key";

-- DropIndex
DROP INDEX "sessions_public_id_key";

-- DropIndex
DROP INDEX "users_public_id_key";

-- AlterTable
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_pkey",
DROP COLUMN "public_id",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "analyses" DROP CONSTRAINT "analyses_pkey",
DROP COLUMN "public_id",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "repo_id",
ADD COLUMN     "repo_id" UUID NOT NULL,
ADD CONSTRAINT "analyses_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "api_keys" DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ALTER COLUMN "id" SET DEFAULT uuidv7();

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "id" SET DEFAULT uuidv7(),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID;

-- AlterTable
ALTER TABLE "banned_emails" DROP CONSTRAINT "banned_emails_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
ADD CONSTRAINT "banned_emails_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "chat_messages" ALTER COLUMN "id" SET DEFAULT uuidv7();

-- AlterTable
ALTER TABLE "chat_sessions" ALTER COLUMN "id" SET DEFAULT uuidv7(),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "repo_id",
ADD COLUMN     "repo_id" UUID;

-- AlterTable
ALTER TABLE "documents" DROP CONSTRAINT "documents_pkey",
DROP COLUMN "public_id",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "repo_id",
ADD COLUMN     "repo_id" UUID NOT NULL,
DROP COLUMN "analysis_id",
ADD COLUMN     "analysis_id" UUID,
ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "generated_fixes" DROP CONSTRAINT "generated_fixes_pkey",
DROP COLUMN "public_id",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "repo_id",
ADD COLUMN     "repo_id" UUID NOT NULL,
DROP COLUMN "pr_analysis_id",
ADD COLUMN     "pr_analysis_id" UUID,
ADD CONSTRAINT "generated_fixes_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "github_installations" DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID;

-- AlterTable
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_pkey",
DROP COLUMN "public_id",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "repo_id",
ADD COLUMN     "repo_id" UUID,
ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "passkeys" ALTER COLUMN "id" SET DEFAULT uuidv7(),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "pr_analysis_configs" DROP CONSTRAINT "pr_analysis_configs_pkey",
DROP COLUMN "public_id",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "repo_id",
ADD COLUMN     "repo_id" UUID NOT NULL,
ADD CONSTRAINT "pr_analysis_configs_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "pull_request_analyses" DROP CONSTRAINT "pull_request_analyses_pkey",
DROP COLUMN "public_id",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "repo_id",
ADD COLUMN     "repo_id" UUID NOT NULL,
ADD CONSTRAINT "pull_request_analyses_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "pull_request_comments" DROP CONSTRAINT "pull_request_comments_pkey",
DROP COLUMN "public_id",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "analysis_id",
ADD COLUMN     "analysis_id" UUID NOT NULL,
ADD CONSTRAINT "pull_request_comments_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "repos" DROP CONSTRAINT "repos_pkey",
DROP COLUMN "public_id",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "repos_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_pkey",
DROP COLUMN "public_id",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "two_factors" ALTER COLUMN "id" SET DEFAULT uuidv7(),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "public_id",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "verification_tokens" ALTER COLUMN "id" SET DEFAULT uuidv7();

-- AlterTable
ALTER TABLE "webhook_deliveries" ALTER COLUMN "id" SET DEFAULT uuidv7();

-- CreateIndex
CREATE UNIQUE INDEX "accounts_user_id_provider_id_key" ON "accounts"("user_id", "provider_id");

-- CreateIndex
CREATE INDEX "analyses_repo_id_status_idx" ON "analyses"("repo_id", "status");

-- CreateIndex
CREATE INDEX "analyses_repo_id_created_at_idx" ON "analyses"("repo_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_operation_idx" ON "audit_logs"("user_id", "operation");

-- CreateIndex
CREATE INDEX "chat_sessions_user_id_idx" ON "chat_sessions"("user_id");

-- CreateIndex
CREATE INDEX "chat_sessions_repo_id_idx" ON "chat_sessions"("repo_id");

-- CreateIndex
CREATE INDEX "documents_analysis_id_idx" ON "documents"("analysis_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_repo_id_version_type_path_key" ON "documents"("repo_id", "version", "type", "path");

-- CreateIndex
CREATE UNIQUE INDEX "documents_repo_id_version_type_analysis_id_key" ON "documents"("repo_id", "version", "type", "analysis_id");

-- CreateIndex
CREATE INDEX "generated_fixes_repo_id_status_idx" ON "generated_fixes"("repo_id", "status");

-- CreateIndex
CREATE INDEX "generated_fixes_repo_id_created_at_idx" ON "generated_fixes"("repo_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "generated_fixes_pr_analysis_id_idx" ON "generated_fixes"("pr_analysis_id");

-- CreateIndex
CREATE INDEX "github_installations_user_id_is_suspended_created_at_idx" ON "github_installations"("user_id", "is_suspended", "created_at" ASC);

-- CreateIndex
CREATE INDEX "github_installations_user_id_is_suspended_account_login_idx" ON "github_installations"("user_id", "is_suspended", "account_login");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_type_created_at_idx" ON "notifications"("user_id", "type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_repo_id_idx" ON "notifications"("repo_id");

-- CreateIndex
CREATE UNIQUE INDEX "pr_analysis_configs_repo_id_key" ON "pr_analysis_configs"("repo_id");

-- CreateIndex
CREATE INDEX "pull_request_analyses_repo_id_status_idx" ON "pull_request_analyses"("repo_id", "status");

-- CreateIndex
CREATE INDEX "pull_request_analyses_repo_id_created_at_idx" ON "pull_request_analyses"("repo_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "pull_request_analyses_repo_id_pr_number_head_sha_key" ON "pull_request_analyses"("repo_id", "pr_number", "head_sha");

-- CreateIndex
CREATE INDEX "pull_request_comments_analysis_id_file_path_idx" ON "pull_request_comments"("analysis_id", "file_path");

-- CreateIndex
CREATE INDEX "repos_user_id_owner_idx" ON "repos"("user_id", "owner");

-- CreateIndex
CREATE INDEX "repos_user_id_name_idx" ON "repos"("user_id", "name");

-- CreateIndex
CREATE INDEX "repos_user_id_visibility_created_at_idx" ON "repos"("user_id", "visibility", "created_at" DESC);

-- CreateIndex
CREATE INDEX "repos_user_id_updated_at_idx" ON "repos"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "repos_owner_name_user_id_key" ON "repos"("owner", "name", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "repos_github_id_user_id_key" ON "repos"("github_id", "user_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "two_factors_user_id_key" ON "two_factors"("user_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repos" ADD CONSTRAINT "repos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_request_analyses" ADD CONSTRAINT "pull_request_analyses_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_analysis_configs" ADD CONSTRAINT "pr_analysis_configs_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_request_comments" ADD CONSTRAINT "pull_request_comments_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "pull_request_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_fixes" ADD CONSTRAINT "generated_fixes_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_fixes" ADD CONSTRAINT "generated_fixes_pr_analysis_id_fkey" FOREIGN KEY ("pr_analysis_id") REFERENCES "pull_request_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

