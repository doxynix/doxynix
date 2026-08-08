-- AlterTable
ALTER TABLE "analyses" ADD COLUMN     "complexity_score" INTEGER,
ADD COLUMN     "result_json" JSONB,
ADD COLUMN     "security_score" INTEGER,
ADD COLUMN     "tech_debt_score" INTEGER,
ALTER COLUMN "status" SET DEFAULT 'NEW';
