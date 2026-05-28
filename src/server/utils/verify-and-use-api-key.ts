import { appLogger } from "../core/app-logger";
import { prisma } from "../core/db";
import { getRawHash } from "./hash";

/**
 * Верифицирует сырой API-ключ по его SHA256-хэшу в базе данных.
 * Автоматически и в фоне обновляет дату последнего использования ключа.
 */
export async function verifyAndUseApiKey(token: string) {
  if (!token.startsWith("dxnx_")) {
    return null;
  }

  const hashedToken = getRawHash(token);

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
