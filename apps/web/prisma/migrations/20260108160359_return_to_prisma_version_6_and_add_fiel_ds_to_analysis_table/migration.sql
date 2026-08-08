-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- AlterTable
ALTER TABLE "analyses" ADD COLUMN     "error" TEXT,
ADD COLUMN     "logs" TEXT;
