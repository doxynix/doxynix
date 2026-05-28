/*
  Warnings:

  - You are about to drop the column `jobId` on the `analyses` table. All the data in the column will be lost.
  - The primary key for the `chat_messages` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `chat_messages` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `chat_messages` table. All the data in the column will be lost.
  - The primary key for the `chat_sessions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `chat_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `repoId` on the `chat_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `chat_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `chat_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `jobId` on the `pull_request_analyses` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[identifier_hash,token_hash]` on the table `verification_tokens` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `session_id` to the `chat_messages` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `chat_messages` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `updated_at` to the `chat_sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `chat_sessions` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `chat_sessions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `path` on table `documents` required. This step will fail if there are existing NULL values in that column.
  - Made the column `token_hash` on table `verification_tokens` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "chat_sessions" DROP CONSTRAINT "chat_sessions_repoId_fkey";

-- DropForeignKey
ALTER TABLE "chat_sessions" DROP CONSTRAINT "chat_sessions_userId_fkey";

-- DropIndex
DROP INDEX "analyses_jobId_idx";

-- DropIndex
DROP INDEX "analyses_status_idx";

-- DropIndex
DROP INDEX "audit_logs_user_id_idx";

-- DropIndex
DROP INDEX "banned_emails_email_key";

-- DropIndex
DROP INDEX "chat_messages_sessionId_idx";

-- DropIndex
DROP INDEX "chat_sessions_repoId_idx";

-- DropIndex
DROP INDEX "chat_sessions_userId_idx";

-- DropIndex
DROP INDEX "documents_repo_id_idx";

-- DropIndex
DROP INDEX "pull_request_comments_analysis_id_idx";

-- DropIndex
DROP INDEX "repos_github_id_idx";

-- DropIndex
DROP INDEX "repos_user_id_created_at_idx";

-- DropIndex
DROP INDEX "repos_user_id_visibility_idx";

-- DropIndex
DROP INDEX "sessions_session_token_key";

-- DropIndex
DROP INDEX "users_email_key";

-- DropIndex
DROP INDEX "verification_tokens_identifier_token_key";

-- DropIndex
DROP INDEX "verification_tokens_token_key";

-- AlterTable
ALTER TABLE "analyses" DROP COLUMN "jobId",
ADD COLUMN     "job_id" TEXT;

-- AlterTable
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "sessionId",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "session_id" UUID NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "chat_sessions" DROP CONSTRAINT "chat_sessions_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "repoId",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "repo_id" INTEGER,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" INTEGER NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "path" SET NOT NULL,
ALTER COLUMN "path" SET DEFAULT '';

-- AlterTable
ALTER TABLE "pull_request_analyses" DROP COLUMN "jobId",
ADD COLUMN     "job_id" TEXT;

-- AlterTable
ALTER TABLE "verification_tokens" ADD COLUMN     "identifier_hash" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "token_hash" SET NOT NULL,
ALTER COLUMN "token_hash" SET DEFAULT '';

-- CreateIndex
CREATE INDEX "analyses_job_id_idx" ON "analyses"("job_id");

-- CreateIndex
CREATE INDEX "chat_messages_session_id_idx" ON "chat_messages"("session_id");

-- CreateIndex
CREATE INDEX "chat_sessions_user_id_idx" ON "chat_sessions"("user_id");

-- CreateIndex
CREATE INDEX "chat_sessions_repo_id_idx" ON "chat_sessions"("repo_id");

-- CreateIndex
CREATE INDEX "pull_request_analyses_job_id_idx" ON "pull_request_analyses"("job_id");

-- CreateIndex
CREATE INDEX "repos_topics_idx" ON "repos" USING GIN ("topics");

-- CreateIndex
CREATE INDEX "repos_user_id_visibility_created_at_idx" ON "repos"("user_id", "visibility", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_hash_token_hash_key" ON "verification_tokens"("identifier_hash", "token_hash");

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
