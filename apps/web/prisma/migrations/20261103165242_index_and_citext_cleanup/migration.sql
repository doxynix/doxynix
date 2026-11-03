-- DropIndex
DROP INDEX "sessions_token_key";

-- DropIndex
DROP INDEX "repos_workspace_id_owner_idx";

-- DropIndex
DROP INDEX "repos_owner_name_workspace_id_key";

-- DropIndex
DROP INDEX "workspace_usage_period_start_idx";

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "email" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "accounts" ALTER COLUMN "email" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "banned_emails" ALTER COLUMN "email" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "repos_workspace_id_owner_name_key" ON "repos"("workspace_id", "owner", "name");

-- CreateIndex
CREATE INDEX "billing_operations_actor_user_id_idx" ON "billing_operations"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_id_idx" ON "audit_logs"("user_id", "created_at" DESC, "id" DESC);

