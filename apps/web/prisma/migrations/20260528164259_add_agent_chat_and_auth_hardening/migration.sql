-- =========================================================================
-- 1. Drop old foreign keys for safe type alterations
-- =========================================================================
ALTER TABLE "chat_messages" DROP CONSTRAINT IF EXISTS "chat_messages_sessionId_fkey";
ALTER TABLE "chat_sessions" DROP CONSTRAINT IF EXISTS "chat_sessions_repoId_fkey";
ALTER TABLE "chat_sessions" DROP CONSTRAINT IF EXISTS "chat_sessions_userId_fkey";

-- =========================================================================
-- 2. Drop obsolete indexes
-- =========================================================================
DROP INDEX IF EXISTS "analyses_jobId_idx";
DROP INDEX IF EXISTS "analyses_status_idx";
DROP INDEX IF EXISTS "audit_logs_user_id_idx";
DROP INDEX IF EXISTS "banned_emails_email_key";
DROP INDEX IF EXISTS "chat_messages_sessionId_idx";
DROP INDEX IF EXISTS "chat_sessions_repoId_idx";
DROP INDEX IF EXISTS "chat_sessions_userId_idx";
DROP INDEX IF EXISTS "documents_repo_id_idx";
DROP INDEX IF EXISTS "pull_request_comments_analysis_id_idx";
DROP INDEX IF EXISTS "repos_github_id_idx";
DROP INDEX IF EXISTS "repos_user_id_created_at_idx";
DROP INDEX IF EXISTS "repos_user_id_visibility_idx";
DROP INDEX IF EXISTS "sessions_session_token_key";
DROP INDEX IF EXISTS "users_email_key";
DROP INDEX IF EXISTS "verification_tokens_identifier_token_key";
DROP INDEX IF EXISTS "verification_tokens_token_key";

-- =========================================================================
-- 3. Safely update table "analyses" (column rename)
-- =========================================================================
ALTER TABLE "analyses" RENAME COLUMN "jobId" TO "job_id";

-- =========================================================================
-- 4. Safely update table "pull_request_analyses" (column rename)
-- =========================================================================
ALTER TABLE "pull_request_analyses" RENAME COLUMN "jobId" TO "job_id";

-- =========================================================================
-- 5. Safely update table "documents" (smart deduplication and NOT NULL)
-- =========================================================================
DELETE FROM "documents" a
USING "documents" b
WHERE a.id < b.id
  AND a.repo_id = b.repo_id
  AND a.version = b.version
  AND a.type = b.type
  AND COALESCE(a.path, '') = COALESCE(b.path, '');

-- Safely fill remaining single NULLs with an empty string
UPDATE "documents" SET "path" = '' WHERE "path" IS NULL;
ALTER TABLE "documents" ALTER COLUMN "path" SET NOT NULL;
ALTER TABLE "documents" ALTER COLUMN "path" SET DEFAULT '';

-- =========================================================================
-- 6. Safely update table "verification_tokens"
-- =========================================================================
-- Add new required column with a default value (safe for existing rows)
ALTER TABLE "verification_tokens" ADD COLUMN "identifier_hash" TEXT NOT NULL DEFAULT '';
-- Eliminate potential NULLs before setting NOT NULL
UPDATE "verification_tokens" SET "token_hash" = '' WHERE "token_hash" IS NULL;
ALTER TABLE "verification_tokens" ALTER COLUMN "token_hash" SET NOT NULL;
ALTER TABLE "verification_tokens" ALTER COLUMN "token_hash" SET DEFAULT '';

-- =========================================================================
-- 7. Safely update table "chat_sessions"
-- =========================================================================
-- Drop primary key constraint to alter "id" column type
ALTER TABLE "chat_sessions" DROP CONSTRAINT IF EXISTS "chat_sessions_pkey";

-- Rename columns camelCase -> snake_case (data is preserved!)
ALTER TABLE "chat_sessions" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "chat_sessions" RENAME COLUMN "repoId" TO "repo_id";
ALTER TABLE "chat_sessions" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "chat_sessions" RENAME COLUMN "userId" TO "user_id";

-- Explicitly convert "id" from TEXT to UUID (using Postgres safe casting)
ALTER TABLE "chat_sessions" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;

-- Restore primary key
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id");

-- =========================================================================
-- 8. Safely update table "chat_messages"
-- =========================================================================
-- Drop primary key constraint
ALTER TABLE "chat_messages" DROP CONSTRAINT IF EXISTS "chat_messages_pkey";

-- Rename columns (data is preserved!)
ALTER TABLE "chat_messages" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "chat_messages" RENAME COLUMN "sessionId" TO "session_id";

-- CRITICAL FIX: Delete corrupted rows with NULL before casting type to UUID!
DELETE FROM "chat_messages" WHERE "session_id" IS NULL;

-- Convert id and session_id to UUID
ALTER TABLE "chat_messages" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;
ALTER TABLE "chat_messages" ALTER COLUMN "session_id" TYPE uuid USING "session_id"::uuid;

-- Restore primary key
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");

-- =========================================================================
-- 9. Create new optimized indexes
-- =========================================================================
CREATE INDEX IF NOT EXISTS "analyses_job_id_idx" ON "analyses"("job_id");
CREATE INDEX IF NOT EXISTS "chat_messages_session_id_idx" ON "chat_messages"("session_id");
CREATE INDEX IF NOT EXISTS "chat_sessions_user_id_idx" ON "chat_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "chat_sessions_repo_id_idx" ON "chat_sessions"("repo_id");
CREATE INDEX IF NOT EXISTS "pull_request_analyses_job_id_idx" ON "pull_request_analyses"("job_id");
CREATE INDEX IF NOT EXISTS "repos_topics_idx" ON "repos" USING GIN ("topics");
CREATE INDEX IF NOT EXISTS "repos_user_id_visibility_created_at_idx" ON "repos"("user_id", "visibility", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "verification_tokens_identifier_hash_token_hash_key" ON "verification_tokens"("identifier_hash", "token_hash");

-- =========================================================================
-- 10. Restore foreign keys with new UUID types
-- =========================================================================
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
