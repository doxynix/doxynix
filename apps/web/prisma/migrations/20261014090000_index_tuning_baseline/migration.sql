-- Baseline for the index work of 2026-10-11..2026-10-12, squashed from eleven migrations.
-- Net effect only: eight drops, twelve creates, no data statements. Idempotent so it
-- can also be applied to a database that already reached this state.
-- DropIndex
DROP INDEX IF EXISTS "public"."audit_logs_created_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "public"."audit_logs_model_request_id_idx";

-- DropIndex
DROP INDEX IF EXISTS "public"."chat_sessions_user_id_idx";

-- DropIndex
DROP INDEX IF EXISTS "public"."notifications_user_id_created_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "public"."notifications_user_id_is_read_created_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "public"."notifications_user_id_type_created_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "public"."repos_topics_idx";

-- DropIndex
DROP INDEX IF EXISTS "public"."repos_user_id_updated_at_idx";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_id_idx" ON "public"."audit_logs"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_operation_created_at_idx" ON "public"."audit_logs"("operation" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_created_at_id_idx" ON "public"."notifications"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_id_idx" ON "public"."notifications"("user_id" ASC, "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_created_at_id_idx" ON "public"."notifications"("user_id" ASC, "is_read" ASC, "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_user_id_type_created_at_id_idx" ON "public"."notifications"("user_id" ASC, "type" ASC, "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "passkeys_user_id_idx" ON "public"."passkeys"("user_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pull_request_analyses_created_at_id_idx" ON "public"."pull_request_analyses"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pull_request_comments_analysis_id_github_comment_id_key" ON "public"."pull_request_comments"("analysis_id" ASC, "github_comment_id" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "repos_updated_at_id_idx" ON "public"."repos"("updated_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "repos_user_id_updated_at_id_idx" ON "public"."repos"("user_id" ASC, "updated_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_created_at_id_idx" ON "public"."users"("created_at" DESC, "id" DESC);
