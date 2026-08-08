-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "repo_id" INTEGER;

-- CreateIndex
CREATE INDEX "notifications_repo_id_idx" ON "notifications"("repo_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
