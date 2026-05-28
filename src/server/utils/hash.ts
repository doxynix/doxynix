import crypto from "node:crypto";

/**
 * Генерирует стандартный хэш SHA-256 для переданного значения.
 */
export function getRawHash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Генерирует хэш SHA-256 для нормализованного (обрезанного и приведенного к нижнему регистру) значения.
 * Соответствует правилам нормализации базы данных: ?normalize=lowercase&normalize=trim.
 */
export function getNormalizedHash(value: string): string {
  const normalized = value.trim().toLowerCase();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}
