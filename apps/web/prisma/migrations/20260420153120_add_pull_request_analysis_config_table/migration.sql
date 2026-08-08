/*
  Warnings:

  - You are about to drop the column `pr_analysis_config` on the `repos` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "repos" DROP COLUMN "pr_analysis_config";

-- CreateTable
CREATE TABLE "PullRequestAnalysisConfig" (
    "id" SERIAL NOT NULL,
    "repo_id" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "commentStyle" TEXT NOT NULL DEFAULT 'detailed',
    "tokenBudget" INTEGER NOT NULL DEFAULT 30000,
    "focusAreas" TEXT[] DEFAULT ARRAY['security', 'performance']::TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PullRequestAnalysisConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PullRequestAnalysisConfig_repo_id_key" ON "PullRequestAnalysisConfig"("repo_id");

-- AddForeignKey
ALTER TABLE "PullRequestAnalysisConfig" ADD CONSTRAINT "PullRequestAnalysisConfig_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
