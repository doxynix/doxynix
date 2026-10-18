-- CreateEnum
CREATE TYPE "ApiKeyScope" AS ENUM ('CLI', 'FULL', 'MCP');

-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN "scopes" "ApiKeyScope"[] NOT NULL DEFAULT ARRAY[]::"ApiKeyScope"[];

-- Backfill rows that predate scopes so they keep working, then make the
-- runtime fail-closed default unnecessary for existing keys.
UPDATE "api_keys" SET "scopes" = ARRAY['FULL']::"ApiKeyScope"[] WHERE "scopes" = ARRAY[]::"ApiKeyScope"[];