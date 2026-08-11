/*
  Warnings:

  - A unique constraint covering the columns `[public_id]` on the table `PullRequestAnalysisConfig` will be added. If there are existing duplicate values, this will fail.
  - The required column `public_id` was added to the `PullRequestAnalysisConfig` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "PullRequestAnalysisConfig" ADD COLUMN     "ci_skip" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "exclude_patterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "public_id" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PullRequestAnalysisConfig_public_id_key" ON "PullRequestAnalysisConfig"("public_id");
