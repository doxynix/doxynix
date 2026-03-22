DROP INDEX IF EXISTS "repos_name_description_idx";

CREATE INDEX IF NOT EXISTS "repos_user_id_name_idx"
ON "repos"("user_id", "name");

CREATE INDEX IF NOT EXISTS "repos_user_id_created_at_idx"
ON "repos"("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_created_at_idx"
ON "notifications"("user_id", "is_read", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "notifications_user_id_type_created_at_idx"
ON "notifications"("user_id", "type", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "github_installations_user_id_is_suspended_account_login_idx"
ON "github_installations"("user_id", "is_suspended", "account_login");
