/*
  Warnings:

  - A unique constraint covering the columns `[repo_id,version,type,path]` on the table `documents` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "path" TEXT,
ALTER COLUMN "analysis_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "documents_repo_id_version_type_path_key" ON "documents"("repo_id", "version", "type", "path");
