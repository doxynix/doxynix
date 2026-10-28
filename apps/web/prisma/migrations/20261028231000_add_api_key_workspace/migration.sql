CREATE TEMP TABLE "api_key_workspace_backfill" AS
SELECT owners."user_id", members."workspace_id"
FROM (SELECT DISTINCT "user_id" FROM "api_keys") AS owners
LEFT JOIN LATERAL (
    SELECT "workspace_id"
    FROM "workspace_members"
    WHERE "user_id" = owners."user_id"
    ORDER BY "created_at" ASC
    LIMIT 1
) AS members ON true;

UPDATE "api_key_workspace_backfill"
SET "workspace_id" = uuidv7()
WHERE "workspace_id" IS NULL;

INSERT INTO "workspaces" ("id", "name", "created_at", "updated_at")
SELECT
    backfill."workspace_id",
    COALESCE(NULLIF(users."name", ''), 'Personal') || ' workspace',
    now(),
    now()
FROM "api_key_workspace_backfill" AS backfill
JOIN "users" ON users."id" = backfill."user_id"
WHERE NOT EXISTS (
    SELECT 1 FROM "workspace_members" WHERE "workspace_members"."user_id" = backfill."user_id"
);

INSERT INTO "workspace_members" ("id", "workspace_id", "user_id", "role", "created_at", "updated_at")
SELECT uuidv7(), "workspace_id", "user_id", 'OWNER', now(), now()
FROM "api_key_workspace_backfill" AS backfill
WHERE NOT EXISTS (
    SELECT 1 FROM "workspace_members" WHERE "workspace_members"."user_id" = backfill."user_id"
);

INSERT INTO "workspace_entitlements" (
    "id",
    "workspace_id",
    "plan_code",
    "seat_limit",
    "repos_limit",
    "private_repos_allowed",
    "auto_resync",
    "pr_reviews",
    "analyses_per_month",
    "ai_tokens_per_month",
    "history_days",
    "created_at",
    "updated_at"
)
SELECT
    uuidv7(),
    "workspace_id",
    'HOBBY',
    1,
    NULL,
    false,
    false,
    false,
    20,
    1000000,
    7,
    now(),
    now()
FROM "api_key_workspace_backfill" AS backfill
WHERE NOT EXISTS (
    SELECT 1 FROM "workspace_entitlements" WHERE "workspace_entitlements"."workspace_id" = backfill."workspace_id"
);

ALTER TABLE "api_keys" ADD COLUMN "workspace_id" UUID;

UPDATE "api_keys"
SET "workspace_id" = backfill."workspace_id"
FROM "api_key_workspace_backfill" AS backfill
WHERE backfill."user_id" = api_keys."user_id";

ALTER TABLE "api_keys" ALTER COLUMN "workspace_id" SET NOT NULL;

DROP TABLE "api_key_workspace_backfill";

CREATE INDEX "api_keys_workspace_id_idx" ON "api_keys"("workspace_id");

ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
