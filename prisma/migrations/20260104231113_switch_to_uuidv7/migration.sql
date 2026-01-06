/*
  Warnings:

  - The primary key for the `api_keys` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `audit_logs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `public_id` on the `analyses` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `api_keys` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `audit_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `public_id` on the `documents` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `public_id` on the `repos` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `public_id` on the `users` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropIndex
DROP INDEX "analyses_repo_id_created_at_idx";

-- AlterTable
ALTER TABLE "analyses" DROP COLUMN "public_id",
ADD COLUMN     "public_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "public_id",
ADD COLUMN     "public_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "repos" DROP COLUMN "public_id",
ADD COLUMN     "public_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "public_id",
ADD COLUMN     "public_id" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "analyses_public_id_key" ON "analyses"("public_id");

-- CreateIndex
CREATE INDEX "analyses_repo_id_status_idx" ON "analyses"("repo_id", "status");

-- CreateIndex
CREATE INDEX "analyses_repo_id_created_at_idx" ON "analyses"("repo_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "documents_public_id_key" ON "documents"("public_id");

-- CreateIndex
CREATE INDEX "documents_repo_id_idx" ON "documents"("repo_id");

-- CreateIndex
CREATE UNIQUE INDEX "repos_public_id_key" ON "repos"("public_id");

-- CreateIndex
CREATE INDEX "repos_github_id_idx" ON "repos"("github_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_public_id_key" ON "users"("public_id");
