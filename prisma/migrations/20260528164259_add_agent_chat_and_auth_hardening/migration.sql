-- =========================================================================
-- 1. Удаляем старые внешние ключи (foreign keys) для безопасного изменения типов
-- =========================================================================
ALTER TABLE "chat_messages" DROP CONSTRAINT IF EXISTS "chat_messages_sessionId_fkey";
ALTER TABLE "chat_sessions" DROP CONSTRAINT IF EXISTS "chat_sessions_repoId_fkey";
ALTER TABLE "chat_sessions" DROP CONSTRAINT IF EXISTS "chat_sessions_userId_fkey";

-- =========================================================================
-- 2. Удаляем старые неактуальные индексы
-- =========================================================================
DROP INDEX IF EXISTS "analyses_jobId_idx";
DROP INDEX IF EXISTS "analyses_status_idx";
DROP INDEX IF EXISTS "audit_logs_user_id_idx";
DROP INDEX IF EXISTS "banned_emails_email_key";
DROP INDEX IF EXISTS "chat_messages_sessionId_idx";
DROP INDEX IF EXISTS "chat_sessions_repoId_idx";
DROP INDEX IF EXISTS "chat_sessions_userId_idx";
DROP INDEX IF EXISTS "documents_repo_id_idx";
DROP INDEX IF EXISTS "pull_request_comments_analysis_id_idx";
DROP INDEX IF EXISTS "repos_github_id_idx";
DROP INDEX IF EXISTS "repos_user_id_created_at_idx";
DROP INDEX IF EXISTS "repos_user_id_visibility_idx";
DROP INDEX IF EXISTS "sessions_session_token_key";
DROP INDEX IF EXISTS "users_email_key";
DROP INDEX IF EXISTS "verification_tokens_identifier_token_key";
DROP INDEX IF EXISTS "verification_tokens_token_key";

-- =========================================================================
-- 3. Безопасное обновление таблицы "analyses" (переименование колонки)
-- =========================================================================
ALTER TABLE "analyses" RENAME COLUMN "jobId" TO "job_id";

-- =========================================================================
-- 4. Безопасное обновление таблицы "pull_request_analyses" (переименование)
-- =========================================================================
ALTER TABLE "pull_request_analyses" RENAME COLUMN "jobId" TO "job_id";

-- =========================================================================
-- 5. Безопасное обновление таблицы "documents" (умная дедупликация и NOT NULL)
-- =========================================================================
DELETE FROM "documents" a
USING "documents" b
WHERE a.id < b.id
  AND a.repo_id = b.repo_id
  AND a.version = b.version
  AND a.type = b.type
  AND COALESCE(a.path, '') = COALESCE(b.path, '');

-- Теперь безопасно заполняем оставшиеся одиночные NULL пустой строкой
UPDATE "documents" SET "path" = '' WHERE "path" IS NULL;
ALTER TABLE "documents" ALTER COLUMN "path" SET NOT NULL;
ALTER TABLE "documents" ALTER COLUMN "path" SET DEFAULT '';

-- =========================================================================
-- 6. Безопасное обновление таблицы "verification_tokens"
-- =========================================================================
-- Добавляем новое обязательное поле с дефолтным значением (безопасно для существующих строк)
ALTER TABLE "verification_tokens" ADD COLUMN "identifier_hash" TEXT NOT NULL DEFAULT '';
-- Устраняем возможные NULL перед установкой NOT NULL
UPDATE "verification_tokens" SET "token_hash" = '' WHERE "token_hash" IS NULL;
ALTER TABLE "verification_tokens" ALTER COLUMN "token_hash" SET NOT NULL;
ALTER TABLE "verification_tokens" ALTER COLUMN "token_hash" SET DEFAULT '';

-- =========================================================================
-- 7. Безопасное обновление таблицы "chat_sessions"
-- =========================================================================
-- Сбрасываем ограничение первичного ключа для изменения типа колонки "id"
ALTER TABLE "chat_sessions" DROP CONSTRAINT IF EXISTS "chat_sessions_pkey";

-- Переименовываем колонки в camelCase -> snake_case (данные сохраняются!)
ALTER TABLE "chat_sessions" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "chat_sessions" RENAME COLUMN "repoId" TO "repo_id";
ALTER TABLE "chat_sessions" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "chat_sessions" RENAME COLUMN "userId" TO "user_id";

-- Принудительно конвертируем поле "id" из TEXT в UUID (используем безопасный кастинг Postgres)
ALTER TABLE "chat_sessions" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;

-- Восстанавливаем первичный ключ
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id");

-- =========================================================================
-- 8. Безопасное обновление таблицы "chat_messages"
-- =========================================================================
-- Сбрасываем ограничение первичного ключа
ALTER TABLE "chat_messages" DROP CONSTRAINT IF EXISTS "chat_messages_pkey";

-- Переименовываем колонки (данные сохраняются!)
ALTER TABLE "chat_messages" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "chat_messages" RENAME COLUMN "sessionId" TO "session_id";

-- КРИТИЧЕСКИЙ ФИКС: Удаляем "битые" строки с NULL перед изменением типа на UUID!
DELETE FROM "chat_messages" WHERE "session_id" IS NULL;

-- Конвертируем id и session_id в UUID
ALTER TABLE "chat_messages" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;
ALTER TABLE "chat_messages" ALTER COLUMN "session_id" TYPE uuid USING "session_id"::uuid;

-- Восстанавливаем первичный ключ
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");

-- =========================================================================
-- 9. Создание новых оптимизированных индексов
-- =========================================================================
CREATE INDEX IF NOT EXISTS "analyses_job_id_idx" ON "analyses"("job_id");
CREATE INDEX IF NOT EXISTS "chat_messages_session_id_idx" ON "chat_messages"("session_id");
CREATE INDEX IF NOT EXISTS "chat_sessions_user_id_idx" ON "chat_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "chat_sessions_repo_id_idx" ON "chat_sessions"("repo_id");
CREATE INDEX IF NOT EXISTS "pull_request_analyses_job_id_idx" ON "pull_request_analyses"("job_id");
CREATE INDEX IF NOT EXISTS "repos_topics_idx" ON "repos" USING GIN ("topics");
CREATE INDEX IF NOT EXISTS "repos_user_id_visibility_created_at_idx" ON "repos"("user_id", "visibility", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "verification_tokens_identifier_hash_token_hash_key" ON "verification_tokens"("identifier_hash", "token_hash");

-- =========================================================================
-- 10. Восстанавливаем внешние ключи (foreign keys) с новыми типами UUID
-- =========================================================================
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
