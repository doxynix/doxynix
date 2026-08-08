/*
  Warnings:

  - A unique constraint covering the columns `[github_installation_id]` on the table `accounts` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "accounts_github_installation_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "accounts_github_installation_id_key" ON "accounts"("github_installation_id");
