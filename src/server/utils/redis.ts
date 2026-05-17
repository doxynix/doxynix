/**
 * Централизованный конфиг для Redis.
 * Избавляет от магических чисел и ошибок в строковых ключах.
 */
export const REDIS_CONFIG = {
  keys: {
    // Результаты аудита конкретного файла
    fileAction: (
      userId: number | string,
      path: string,
      action: "document-file-preview" | "quick-file-audit"
    ): string => `file-result:${userId}:${action}:${path}`,

    // Результаты генерации фиксов (код для диффа)
    fixResult: (fixId: string): string => `fix-result:${fixId}`,

    // Staging area для пакетных PR
    prStaging: (userId: number | string, repoId: string): string => `pr-stage:${userId}:${repoId}`,
  },

  // Время жизни ключей в секундах
  ttl: {
    fileAction: 86_400, // 24 часа
    fixResult: 3600, // 1 час
    prStaging: 86_400, // 24 часа
  },
} as const;
