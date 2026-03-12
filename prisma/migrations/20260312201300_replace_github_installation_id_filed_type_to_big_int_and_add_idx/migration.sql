-- AlterTable
ALTER TABLE "accounts" ALTER COLUMN "github_installation_id" SET DATA TYPE BIGINT;

-- CreateIndex
CREATE INDEX "accounts_github_installation_id_idx" ON "accounts"("github_installation_id");
