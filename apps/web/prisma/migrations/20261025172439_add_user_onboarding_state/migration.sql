-- CreateEnum
CREATE TYPE "OnboardingIntent" AS ENUM ('ARCHITECTURE', 'DOCUMENTATION', 'RISKS');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "activated_at" TIMESTAMP(3),
ADD COLUMN     "onboarding_checklist_dismissed_at" TIMESTAMP(3),
ADD COLUMN     "onboarding_completed_at" TIMESTAMP(3),
ADD COLUMN     "onboarding_intent" "OnboardingIntent";
