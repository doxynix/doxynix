import { appLogger } from "../core/app-logger";
import { prisma } from "../core/db";
import { extractPayloadFromKey, getApiKeyHash, validateApiKeyChecksum } from "./hash";

/**
 * Верифицирует сырой API-ключ по его HMAC-SHA256 хэшу в базе данных.
 * Сначала проверяет контрольную сумму на CPU, а хэширует и ищет в БД только payload.
 */
export async function verifyAndUseApiKey(token: string) {
  if (!validateApiKeyChecksum(token)) {
    return null;
  }

  const payload = extractPayloadFromKey(token);
  if (payload == null) {
    return null;
  }

  const hashedToken = getApiKeyHash(payload);

  const keyRecord = await prisma.apiKey.findUnique({
    include: { user: true },
    where: { hashedKey: hashedToken },
  });

  if (keyRecord == null || keyRecord.revoked === true) {
    return null;
  }

  prisma.apiKey
    .update({
      data: { lastUsed: new Date() },
      where: { id: keyRecord.id },
    })
    .catch((error) =>
      appLogger.error({
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        keyId: keyRecord.id,
        msg: "Failed to update api key lastUsed",
      })
    );

  return keyRecord;
}
