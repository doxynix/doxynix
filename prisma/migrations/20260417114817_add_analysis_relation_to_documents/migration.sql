/*
  Warnings:

  - A unique constraint covering the columns `[repo_id,version,type,analysis_id]` on the table `documents` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "documents_repo_id_version_type_key";

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "analysis_id" INTEGER;

-- CreateIndex
CREATE INDEX "documents_analysis_id_idx" ON "documents"("analysis_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_repo_id_version_type_analysis_id_key" ON "documents"("repo_id", "version", "type", "analysis_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
