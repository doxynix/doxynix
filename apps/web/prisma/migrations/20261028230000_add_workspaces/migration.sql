-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_entitlements" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "workspace_id" UUID NOT NULL,
    "plan_code" TEXT NOT NULL DEFAULT 'HOBBY',
    "seat_limit" INTEGER NOT NULL DEFAULT 1,
    "repos_limit" INTEGER,
    "private_repos_allowed" BOOLEAN NOT NULL DEFAULT false,
    "auto_resync" BOOLEAN NOT NULL DEFAULT false,
    "pr_reviews" BOOLEAN NOT NULL DEFAULT false,
    "analyses_per_month" INTEGER,
    "ai_tokens_per_month" INTEGER,
    "history_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_entitlements_pkey" PRIMARY KEY ("id")
);

-- Preserve the creator instead of dropping the column and its data
ALTER TABLE "repos" RENAME COLUMN "user_id" TO "created_by_user_id";

ALTER TABLE "repos" ADD COLUMN "workspace_id" UUID;
ALTER TABLE "github_installations" ADD COLUMN "workspace_id" UUID;

-- Existing resources keep working: one personal HOBBY workspace per owner
CREATE TEMP TABLE "workspace_backfill" AS
SELECT "user_id", uuidv7() AS "workspace_id"
FROM (
    SELECT DISTINCT "created_by_user_id" AS "user_id" FROM "repos"
    UNION
    SELECT DISTINCT "user_id" FROM "github_installations" WHERE "user_id" IS NOT NULL
) AS owners;

INSERT INTO "workspaces" ("id", "name", "created_at", "updated_at")
SELECT
    backfill."workspace_id",
    COALESCE(NULLIF(users."name", ''), 'Personal') || ' workspace',
    now(),
    now()
FROM "workspace_backfill" AS backfill
JOIN "users" ON users."id" = backfill."user_id";

INSERT INTO "workspace_members" ("id", "workspace_id", "user_id", "role", "created_at", "updated_at")
SELECT uuidv7(), "workspace_id", "user_id", 'OWNER', now(), now()
FROM "workspace_backfill";

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
FROM "workspace_backfill";

UPDATE "repos"
SET "workspace_id" = backfill."workspace_id"
FROM "workspace_backfill" AS backfill
WHERE repos."created_by_user_id" = backfill."user_id";

UPDATE "github_installations"
SET "workspace_id" = backfill."workspace_id"
FROM "workspace_backfill" AS backfill
WHERE github_installations."user_id" = backfill."user_id";

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "repos" WHERE "workspace_id" IS NULL) THEN
        RAISE EXCEPTION 'repos without workspace backfill';
    END IF;
    IF EXISTS (SELECT 1 FROM "github_installations" WHERE "workspace_id" IS NULL) THEN
        RAISE EXCEPTION 'github_installations without workspace backfill';
    END IF;
END $$;

ALTER TABLE "repos" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "github_installations" ALTER COLUMN "workspace_id" SET NOT NULL;

DROP TABLE "workspace_backfill";

-- DropForeignKey
ALTER TABLE "repos" DROP CONSTRAINT "repos_user_id_fkey";

-- DropIndex
DROP INDEX "repos_user_id_owner_idx";

-- DropIndex
DROP INDEX "repos_user_id_name_idx";

-- DropIndex
DROP INDEX "repos_user_id_visibility_created_at_idx";

-- DropIndex
DROP INDEX "repos_user_id_updated_at_id_idx";

-- DropIndex
DROP INDEX "repos_owner_name_user_id_key";

-- DropIndex
DROP INDEX "repos_github_id_user_id_key";

-- DropIndex
DROP INDEX "github_installations_user_id_is_suspended_created_at_idx";

-- DropIndex
DROP INDEX "github_installations_user_id_is_suspended_account_login_idx";

-- CreateIndex
CREATE INDEX "workspaces_created_at_id_idx" ON "workspaces"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "workspace_members_user_id_workspace_id_idx" ON "workspace_members"("user_id", "workspace_id");

-- CreateIndex
CREATE INDEX "workspace_members_workspace_id_role_idx" ON "workspace_members"("workspace_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_entitlements_workspace_id_key" ON "workspace_entitlements"("workspace_id");

-- CreateIndex
CREATE INDEX "workspace_entitlements_plan_code_idx" ON "workspace_entitlements"("plan_code");

-- CreateIndex
CREATE INDEX "repos_workspace_id_owner_idx" ON "repos"("workspace_id", "owner");

-- CreateIndex
CREATE INDEX "repos_workspace_id_name_idx" ON "repos"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "repos_workspace_id_visibility_created_at_idx" ON "repos"("workspace_id", "visibility", "created_at" DESC);

-- CreateIndex
CREATE INDEX "repos_workspace_id_updated_at_id_idx" ON "repos"("workspace_id", "updated_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "repos_created_by_user_id_idx" ON "repos"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "repos_owner_name_workspace_id_key" ON "repos"("owner", "name", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "repos_github_id_workspace_id_key" ON "repos"("github_id", "workspace_id");

-- CreateIndex
CREATE INDEX "github_installations_workspace_id_is_suspended_created_at_idx" ON "github_installations"("workspace_id", "is_suspended", "created_at" ASC);

-- CreateIndex
CREATE INDEX "github_installations_workspace_id_is_suspended_account_logi_idx" ON "github_installations"("workspace_id", "is_suspended", "account_login");

-- CreateIndex
CREATE INDEX "github_installations_user_id_idx" ON "github_installations"("user_id");

-- AddForeignKey
ALTER TABLE "repos" ADD CONSTRAINT "repos_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repos" ADD CONSTRAINT "repos_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_entitlements" ADD CONSTRAINT "workspace_entitlements_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
