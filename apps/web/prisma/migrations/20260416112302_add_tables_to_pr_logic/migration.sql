-- CreateEnum
CREATE TYPE "PRAnalysisStatus" AS ENUM ('PENDING', 'ANALYZING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "FixStatus" AS ENUM ('DRAFT', 'READY_TO_APPLY', 'PR_OPENED', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "repos" ADD COLUMN     "pr_analysis_config" JSONB;

-- CreateTable
CREATE TABLE "pull_request_analyses" (
    "id" SERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "owner" TEXT NOT NULL,
    "repo_name" TEXT NOT NULL,
    "head_sha" TEXT NOT NULL,
    "base_sha" TEXT NOT NULL,
    "status" "PRAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "risk_score" INTEGER,
    "findings_json" JSONB,
    "jobId" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "repo_id" INTEGER NOT NULL,

    CONSTRAINT "pull_request_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pull_request_comments" (
    "id" SERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "file_path" TEXT NOT NULL,
    "line" INTEGER NOT NULL,
    "risk_level" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "finding_type" TEXT NOT NULL,
    "github_comment_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "analysis_id" INTEGER NOT NULL,

    CONSTRAINT "pull_request_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_fixes" (
    "id" SERIAL NOT NULL,
    "public_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "branch" TEXT NOT NULL,
    "status" "FixStatus" NOT NULL DEFAULT 'DRAFT',
    "estimated_impact" INTEGER,
    "diff_json" JSONB,
    "github_pr_url" TEXT,
    "github_pr_number" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user" BOOLEAN NOT NULL DEFAULT false,
    "repo_id" INTEGER NOT NULL,
    "pr_analysis_id" INTEGER,

    CONSTRAINT "generated_fixes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pull_request_analyses_public_id_key" ON "pull_request_analyses"("public_id");

-- CreateIndex
CREATE INDEX "pull_request_analyses_repo_id_status_idx" ON "pull_request_analyses"("repo_id", "status");

-- CreateIndex
CREATE INDEX "pull_request_analyses_repo_id_created_at_idx" ON "pull_request_analyses"("repo_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "pull_request_analyses_status_idx" ON "pull_request_analyses"("status");

-- CreateIndex
CREATE UNIQUE INDEX "pull_request_analyses_repo_id_pr_number_key" ON "pull_request_analyses"("repo_id", "pr_number");

-- CreateIndex
CREATE UNIQUE INDEX "pull_request_comments_public_id_key" ON "pull_request_comments"("public_id");

-- CreateIndex
CREATE INDEX "pull_request_comments_analysis_id_file_path_idx" ON "pull_request_comments"("analysis_id", "file_path");

-- CreateIndex
CREATE INDEX "pull_request_comments_analysis_id_idx" ON "pull_request_comments"("analysis_id");

-- CreateIndex
CREATE UNIQUE INDEX "generated_fixes_public_id_key" ON "generated_fixes"("public_id");

-- CreateIndex
CREATE INDEX "generated_fixes_repo_id_status_idx" ON "generated_fixes"("repo_id", "status");

-- CreateIndex
CREATE INDEX "generated_fixes_repo_id_created_at_idx" ON "generated_fixes"("repo_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "generated_fixes_pr_analysis_id_idx" ON "generated_fixes"("pr_analysis_id");

-- AddForeignKey
ALTER TABLE "pull_request_analyses" ADD CONSTRAINT "pull_request_analyses_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_request_comments" ADD CONSTRAINT "pull_request_comments_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "pull_request_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_fixes" ADD CONSTRAINT "generated_fixes_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_fixes" ADD CONSTRAINT "generated_fixes_pr_analysis_id_fkey" FOREIGN KEY ("pr_analysis_id") REFERENCES "pull_request_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
