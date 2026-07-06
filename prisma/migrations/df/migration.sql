/*
  Warnings:

  - You are about to drop the column `expires_at` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `provider_account_id` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `refresh_token_expires_in` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `session_state` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `expires` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `session_token` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `session_token_hash` on the `sessions` table. All the data in the column will be lost.
  - The `email_verified` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `expires` on the `verification_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `token` on the `verification_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `token_hash` on the `verification_tokens` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[provider_id,account_id]` on the table `accounts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,provider_id]` on the table `accounts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[token]` on the table `sessions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[token_hash]` on the table `sessions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[value_hash]` on the table `verification_tokens` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[identifier_hash,value_hash]` on the table `verification_tokens` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `account_id` to the `accounts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provider_id` to the `accounts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expires_at` to the `sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `token` to the `sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expires_at` to the `verification_tokens` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `verification_tokens` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `value` to the `verification_tokens` table without a default value. This is not possible if the table is not empty.

*/
DROP INDEX IF EXISTS "accounts_provider_provider_account_id_key";
DROP INDEX IF EXISTS "accounts_user_id_provider_key";
DROP INDEX IF EXISTS "sessions_session_token_hash_key";
DROP INDEX IF EXISTS "verification_tokens_identifier_hash_token_hash_key";
DROP INDEX IF EXISTS "verification_tokens_token_hash_key";

TRUNCATE TABLE "verification_tokens";

ALTER TABLE "accounts" RENAME COLUMN "provider_account_id" TO "account_id";
ALTER TABLE "accounts" RENAME COLUMN "provider" TO "provider_id";

ALTER TABLE "sessions" RENAME COLUMN "session_token" TO "token";
ALTER TABLE "sessions" RENAME COLUMN "expires" TO "expires_at";

ALTER TABLE "users" ADD COLUMN "email_verified_bool" BOOLEAN NOT NULL DEFAULT false;
UPDATE "users" SET "email_verified_bool" = true WHERE "email_verified" IS NOT NULL;
ALTER TABLE "users" DROP COLUMN "email_verified";
ALTER TABLE "users" RENAME COLUMN "email_verified_bool" TO "email_verified";

ALTER TABLE "accounts" ADD COLUMN "access_token_expires_at" TIMESTAMP(3);
UPDATE "accounts" SET "access_token_expires_at" = to_timestamp("expires_at") WHERE "expires_at" IS NOT NULL;
ALTER TABLE "accounts" DROP COLUMN "expires_at";

ALTER TABLE "accounts"
  DROP COLUMN IF EXISTS "refresh_token_expires_in",
  DROP COLUMN IF EXISTS "session_state",
  DROP COLUMN IF EXISTS "type";

ALTER TABLE "accounts"
  ADD COLUMN "impersonated_by" TEXT,
  ADD COLUMN "refresh_token_expires_at" TIMESTAMP(3);

ALTER TABLE "sessions" DROP COLUMN IF EXISTS "session_token_hash";

ALTER TABLE "sessions"
  ADD COLUMN "ip_address" TEXT,
  ADD COLUMN "token_hash" TEXT,
  ADD COLUMN "user_agent" TEXT;

ALTER TABLE "users"
  ADD COLUMN "ban_expires" TIMESTAMP(3),
  ADD COLUMN "ban_reason" TEXT,
  ADD COLUMN "banned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "last_login_method" TEXT,
  ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "verification_tokens"
  DROP COLUMN IF EXISTS "expires",
  DROP COLUMN IF EXISTS "token",
  DROP COLUMN IF EXISTS "token_hash";

ALTER TABLE "verification_tokens"
  ADD COLUMN "expires_at" TIMESTAMP(3) NOT NULL,
  ADD COLUMN "id" UUID NOT NULL,
  ADD COLUMN "value" TEXT NOT NULL,
  ADD COLUMN "value_hash" TEXT NOT NULL DEFAULT '',
  ADD CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id");

CREATE TABLE "passkeys" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "public_key" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "credential_id" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "device_type" TEXT NOT NULL,
    "backed_up" BOOLEAN NOT NULL,
    "transports" TEXT,
    "aaguid" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "passkeys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "two_factors" (
    "id" UUID NOT NULL,
    "secret" TEXT NOT NULL,
    "backup_codes" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "passkeys_credential_id_key" ON "passkeys"("credential_id");
CREATE UNIQUE INDEX "two_factors_user_id_key" ON "two_factors"("user_id");
CREATE UNIQUE INDEX "accounts_provider_id_account_id_key" ON "accounts"("provider_id", "account_id");
CREATE UNIQUE INDEX "accounts_user_id_provider_id_key" ON "accounts"("user_id", "provider_id");
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE UNIQUE INDEX "verification_tokens_value_hash_key" ON "verification_tokens"("value_hash");
CREATE UNIQUE INDEX "verification_tokens_identifier_hash_value_hash_key" ON "verification_tokens"("identifier_hash", "value_hash");

ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
