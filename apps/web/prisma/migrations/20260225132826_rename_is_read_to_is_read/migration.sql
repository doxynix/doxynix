ALTER TABLE "notifications" RENAME COLUMN "isRead" TO "is_read";

ALTER TABLE "notifications" ALTER COLUMN "is_read" SET DEFAULT false;

DROP INDEX "notifications_user_id_isRead_idx";
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");
