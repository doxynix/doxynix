/*
  Warnings:

  - You are about to drop the `PullRequestAnalysisConfig` table. If the table is not empty, all the data it contains will be lost.
  - Changed the type of `target_type` on the `github_installations` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `repository_selection` on the `github_installations` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "PRCommentStyle" AS ENUM ('CONCISE', 'DETAILED', 'OFF');

-- CreateEnum
CREATE TYPE "PRFocusArea" AS ENUM ('SECURITY', 'PERFORMANCE', 'ARCHITECTURE', 'STYLE');

-- CreateEnum
CREATE TYPE "InstallationTargetType" AS ENUM ('USER', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "RepositorySelection" AS ENUM ('ALL', 'SELECTED');

-- DropForeignKey
ALTER TABLE "PullRequestAnalysisConfig" DROP CONSTRAINT "PullRequestAnalysisConfig_repo_id_fkey";

-- AlterTable
ALTER TABLE "github_installations" DROP COLUMN "target_type",
ADD COLUMN     "target_type" "InstallationTargetType" NOT NULL,
DROP COLUMN "repository_selection",
ADD COLUMN     "repository_selection" "RepositorySelection" NOT NULL;

-- DropTable
DROP TABLE "PullRequestAnalysisConfig";

-- CreateTable
CREATE TABLE "pr_analysis_configs" (
    "id" SERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "ci_skip" BOOLEAN NOT NULL DEFAULT false,
    "comment_style" "PRCommentStyle" NOT NULL DEFAULT 'DETAILED',
    "tokenBudget" INTEGER NOT NULL DEFAULT 30000,
    "focus_areas" "PRFocusArea"[] DEFAULT ARRAY['SECURITY', 'PERFORMANCE']::"PRFocusArea"[],
    "exclude_patterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL,
    "repo_id" INTEGER NOT NULL,

    CONSTRAINT "pr_analysis_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pr_analysis_configs_public_id_key" ON "pr_analysis_configs"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "pr_analysis_configs_repo_id_key" ON "pr_analysis_configs"("repo_id");

-- AddForeignKey
ALTER TABLE "pr_analysis_configs" ADD CONSTRAINT "pr_analysis_configs_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
