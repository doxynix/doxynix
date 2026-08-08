-- AlterTable
ALTER TABLE "repos" ADD COLUMN     "github_created_at" TIMESTAMP(3),
ADD COLUMN     "license" TEXT,
ADD COLUMN     "open_issues_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pushed_at" TIMESTAMP(3),
ADD COLUMN     "size" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "topics" TEXT[];
