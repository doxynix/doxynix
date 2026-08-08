/*
  Warnings:

  - A unique constraint covering the columns `[github_id,user_id]` on the table `repos` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `github_id` to the `repos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "repos" ADD COLUMN     "github_id" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "repos_user_id_updated_at_idx" ON "repos"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "repos_user_id_visibility_idx" ON "repos"("user_id", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX "repos_github_id_user_id_key" ON "repos"("github_id", "user_id");
