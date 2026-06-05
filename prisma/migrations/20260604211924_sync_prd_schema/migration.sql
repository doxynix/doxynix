-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_analysis_id_fkey";

-- DropIndex
DROP INDEX "pull_request_analyses_repo_id_pr_number_key";

-- AlterTable
ALTER TABLE "generated_fixes" DROP COLUMN "diff_json";

-- AlterTable
ALTER TABLE "pr_analysis_configs" RENAME CONSTRAINT "PullRequestAnalysisConfig_pkey" TO "pr_analysis_configs_pkey";
ALTER TABLE "pr_analysis_configs" DROP COLUMN "comment_style";
ALTER TABLE "pr_analysis_configs" ADD COLUMN "comment_style" "PRCommentStyle" NOT NULL DEFAULT 'DETAILED';
ALTER TABLE "pr_analysis_configs" DROP COLUMN "focus_areas";
ALTER TABLE "pr_analysis_configs" ADD COLUMN "focus_areas" "PRFocusArea"[] DEFAULT ARRAY['SECURITY', 'PERFORMANCE']::"PRFocusArea"[];

-- CreateIndex
CREATE UNIQUE INDEX "pull_request_analyses_repo_id_pr_number_head_sha_key" ON "pull_request_analyses"("repo_id", "pr_number", "head_sha");

-- RenameForeignKey
ALTER TABLE "pr_analysis_configs" RENAME CONSTRAINT "PullRequestAnalysisConfig_repo_id_fkey" TO "pr_analysis_configs_repo_id_fkey";

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "PullRequestAnalysisConfig_public_id_key" RENAME TO "pr_analysis_configs_public_id_key";

-- RenameIndex
ALTER INDEX "PullRequestAnalysisConfig_repo_id_key" RENAME TO "pr_analysis_configs_repo_id_key";
