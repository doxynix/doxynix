/*
  Warnings:

  - A unique constraint covering the columns `[email_hash]` on the table `banned_emails` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[session_token_hash]` on the table `sessions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email_hash]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[token_hash]` on the table `verification_tokens` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email_hash` to the `banned_emails` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "email_hash" TEXT;

-- AlterTable
ALTER TABLE "banned_emails" ADD COLUMN     "email_hash" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "session_token_hash" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_hash" TEXT;

-- AlterTable
ALTER TABLE "verification_tokens" ADD COLUMN     "token_hash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "banned_emails_email_hash_key" ON "banned_emails"("email_hash");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_hash_key" ON "sessions"("session_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_hash_key" ON "users"("email_hash");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_hash_key" ON "verification_tokens"("token_hash");
