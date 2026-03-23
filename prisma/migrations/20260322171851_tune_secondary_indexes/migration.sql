-- Remove the shorter duplicate index; the longer composite index covers the same filter.
DROP INDEX IF EXISTS "notifications_user_id_is_read_idx";

-- Replace the generic user index with one that matches the installations list query.
DROP INDEX IF EXISTS "github_installations_user_id_idx";

CREATE INDEX IF NOT EXISTS "github_installations_user_id_is_suspended_created_at_idx"
ON "github_installations"("user_id", "is_suspended", "created_at" ASC);
