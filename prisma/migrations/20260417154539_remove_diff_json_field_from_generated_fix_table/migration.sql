/*
  Warnings:

  - You are about to drop the column `diff_json` on the `generated_fixes` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[repo_id,pr_number,head_sha]` on the table `pull_request_analyses` will be added. If there are existing duplicate values, this will fail.
  - Made the column `analysis_id` on table `documents` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_analysis_id_fkey";

-- DropIndex
DROP INDEX "pull_request_analyses_repo_id_pr_number_key";

-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "analysis_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "generated_fixes" DROP COLUMN "diff_json";

-- CreateIndex
CREATE UNIQUE INDEX "pull_request_analyses_repo_id_pr_number_head_sha_key" ON "pull_request_analyses"("repo_id", "pr_number", "head_sha");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
