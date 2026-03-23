ALTER TABLE "repos"
ALTER COLUMN "owner" TYPE TEXT USING "owner"::text,
ALTER COLUMN "name" TYPE TEXT USING "name"::text;

DROP INDEX IF EXISTS "repos_name_trgm_idx";
DROP INDEX IF EXISTS "repos_owner_trgm_idx";

CREATE INDEX IF NOT EXISTS "repos_name_trgm_idx"
ON "repos" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "repos_owner_trgm_idx"
ON "repos" USING GIN ("owner" gin_trgm_ops);
