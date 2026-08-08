-- Extensions required for case-insensitive equality and trigram search.
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Case-insensitive exact matching for GitHub identities and repo slugs.
ALTER TABLE "github_installations"
ALTER COLUMN "account_login" SET DATA TYPE CITEXT;

ALTER TABLE "repos"
ALTER COLUMN "owner" SET DATA TYPE CITEXT,
ALTER COLUMN "name" SET DATA TYPE CITEXT;

ALTER TABLE "users"
ALTER COLUMN "email" SET DATA TYPE CITEXT;

-- pg_trgm exposes gin_trgm_ops; for CITEXT columns PostgreSQL can still use it directly.
-- Repo search is substring-heavy for GitHub-style slugs, so use trigram indexes.
CREATE INDEX IF NOT EXISTS "repos_name_trgm_idx"
ON "repos" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "repos_owner_trgm_idx"
ON "repos" USING GIN ("owner" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "repos_description_trgm_idx"
ON "repos" USING GIN ("description" gin_trgm_ops);

-- Notifications are searched with case-insensitive substring matching.
CREATE INDEX IF NOT EXISTS "notifications_title_trgm_idx"
ON "notifications" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "notifications_body_trgm_idx"
ON "notifications" USING GIN ("body" gin_trgm_ops);
