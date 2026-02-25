-- 1. Сначала удаляем старые внешние ключи и индексы (Prisma их пересоздаст позже)
ALTER TABLE "api_keys" DROP CONSTRAINT IF EXISTS "api_keys_userId_fkey";
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_userId_fkey";

DROP INDEX IF EXISTS "api_keys_userId_idx";
DROP INDEX IF EXISTS "notifications_userId_createdAt_idx";
DROP INDEX IF EXISTS "notifications_userId_isRead_idx";

ALTER TABLE "api_keys" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "notifications" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "notifications" RENAME COLUMN "createdAt" TO "created_at";

CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");
CREATE INDEX "notifications_user_id_isRead_idx" ON "notifications"("user_id", "isRead");
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
