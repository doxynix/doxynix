-- AlterTable
ALTER TABLE "repos" ADD COLUMN     "default_branch" TEXT NOT NULL DEFAULT 'main',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "forks_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "owner_avatar_url" TEXT,
ADD COLUMN     "stargazers_count" INTEGER NOT NULL DEFAULT 0;
