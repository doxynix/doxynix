/*
  Warnings:

  - You are about to drop the column `github_installation_id` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `github_installation_url` on the `accounts` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "accounts_github_installation_id_key";

-- AlterTable
ALTER TABLE "accounts" DROP COLUMN "github_installation_id",
DROP COLUMN "github_installation_url";

-- CreateTable
CREATE TABLE "github_installations" (
    "id" BIGINT NOT NULL,
    "app_id" INTEGER NOT NULL,
    "target_id" BIGINT NOT NULL,
    "target_type" TEXT NOT NULL,
    "account_login" TEXT NOT NULL,
    "account_avatar" TEXT,
    "repository_selection" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" INTEGER,

    CONSTRAINT "github_installations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "github_installations_user_id_idx" ON "github_installations"("user_id");

-- AddForeignKey
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
