-- CreateEnum
CREATE TYPE "BannedEmailReason" AS ENUM ('BOUNCED', 'COMPLAINED', 'SUPPRESSED', 'FAILED', 'DISPOSABLE', 'MANUAL');

-- CreateTable
CREATE TABLE "banned_emails" (
    "id" SERIAL NOT NULL,
    "email" CITEXT NOT NULL,
    "reason" "BannedEmailReason" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banned_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "banned_emails_email_key" ON "banned_emails"("email");
