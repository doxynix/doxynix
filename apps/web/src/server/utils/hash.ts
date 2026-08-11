import crypto from "node:crypto";

import {
  API_KEY_CHECKSUM_SECRET,
  API_KEY_PEPPER,
  PRISMA_FIELD_ENCRYPTION_HASH_SALT,
} from "@/shared/constants/env.server";

const BRAND_PREFIX = "dxnx_";
const CHECKSUM_LENGTH = 8;
const PAYLOAD_LENGTH = 32;
const TOTAL_KEY_LENGTH = BRAND_PREFIX.length + PAYLOAD_LENGTH + CHECKSUM_LENGTH;
const HEX_REGEX = /^[\da-f]{8}$/;

/**
 * Генерирует криптографическую контрольную сумму (первые 8 символов HMAC-SHA256) для нагрузки ключа.
 */
// codeql[js/insufficient-password-hash]
function calculateChecksum(payload: string): string {
  return crypto
    .createHmac("sha256", API_KEY_CHECKSUM_SECRET)
    .update(payload)
    .digest("hex")
    .slice(0, CHECKSUM_LENGTH);
}

/**
 * Генерирует новый безопасный API-ключ со встроенной чексуммой в сплошном формате (Continuous PAT).
 * Формат: dxnx_[32_символа_нагрузки][8_символов_чексуммы] (Итого: ровно 45 символов)
 * Пример: dxnx_Y29uc29saWRhdGVkX2V4Y2VwdGlvbg2b6c7d8
 */
export function generateApiKey(): string {
  const payload = crypto.randomBytes(24).toString("base64url");
  const checksum = calculateChecksum(payload);
  return `${BRAND_PREFIX}${payload}${checksum}`;
}

/**
 * Валидирует контрольную сумму API-ключа локально на CPU без обращений к базе данных.
 */
export function validateApiKeyChecksum(apiKey: string): boolean {
  if (
    typeof apiKey !== "string" ||
    apiKey.length !== TOTAL_KEY_LENGTH ||
    !apiKey.startsWith(BRAND_PREFIX)
  ) {
    return false;
  }

  const cleanKey = apiKey.slice(BRAND_PREFIX.length);

  const payload = cleanKey.slice(0, PAYLOAD_LENGTH);
  const checksum = cleanKey.slice(PAYLOAD_LENGTH);

  if (!HEX_REGEX.test(checksum)) return false;

  const expectedChecksum = calculateChecksum(payload);

  const bufChecksum = Buffer.from(checksum);
  const bufExpected = Buffer.from(expectedChecksum);

  return crypto.timingSafeEqual(bufChecksum, bufExpected);
}

/**
 * Вспомогательный метод для безопасного извлечения payload из ключа (для хэширования в БД)
 */
export function extractPayloadFromKey(apiKey: string): null | string {
  if (!validateApiKeyChecksum(apiKey)) return null;
  return apiKey.slice(BRAND_PREFIX.length, BRAND_PREFIX.length + PAYLOAD_LENGTH);
}

/**
 * Генерирует стандартный хэш SHA-256 для переданного значения.
 * ИСПОЛЬЗУЕТСЯ СТРОГО ДЛЯ PRISMA: для обеспечения 100% совместимости с нативной
 * генерацией хэшей в библиотеке "prisma-field-encryption".
 */
export function getRawHash(value: string): string {
  const input = PRISMA_FIELD_ENCRYPTION_HASH_SALT
    ? value + PRISMA_FIELD_ENCRYPTION_HASH_SALT
    : value;
  return crypto.hash("sha256", input);
}

/**
 * Генерирует быстрый хэш-подпись HMAC-SHA256 для хранения API-ключей в БД.
 * Метод абсолютно безопасен, так как исходный payload имеет высокую энтропию (192 бита).
 * Использование HMAC гарантирует защиту от перебора при утечке БД (благодаря секретному API_KEY_PEPPER).
 * ИСПОЛЬЗОВАТЬ СТРОГО ДЛЯ СТРОК С ВЫСОКОЙ ЭНТРОПИЕЙ!
 */
// codeql[js/insufficient-password-hash]
export function getApiKeyHash(payload: string): string {
  return crypto.createHmac("sha256", API_KEY_PEPPER).update(payload).digest("hex");
}

/**
 * Генерирует хэш SHA-256 для нормализованного значения с поддержкой Unicode NFC-нормализации.
 * ИСПОЛЬЗУЕТСЯ СТРОГО ДЛЯ PRISMA.
 */
export function getNormalizedHash(value: string): string {
  const normalized = value.trim().normalize("NFC").toLowerCase();
  return getRawHash(normalized);
}
