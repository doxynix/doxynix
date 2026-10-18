import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { extractPayloadFromKey, getApiKeyHash, validateApiKeyChecksum } from "@/server/utils/hash";

function retireExpiredKey(keyId: string, msg: string) {
  void prisma.apiKey.update({ data: { revoked: true }, where: { id: keyId } }).catch((error) =>
    appLogger.error({
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      keyId,
      msg,
    }),
  );
}

// Checksum is checked on the CPU first so only the payload is hashed and looked up in the DB.
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

  if (keyRecord == null) {
    return null;
  }

  const now = Date.now();

  if (keyRecord.revokedAfter != null) {
    if (keyRecord.revokedAfter.getTime() <= now) {
      retireExpiredKey(keyRecord.id, "Failed to retire a rotated api key past its grace window");
      return null;
    }
  } else if (keyRecord.revoked) {
    return null;
  }

  if (keyRecord.expiresAt != null && keyRecord.expiresAt.getTime() <= now) {
    retireExpiredKey(keyRecord.id, "Failed to revoke expired api key");
    return null;
  }

  void prisma.apiKey
    .update({
      data: { lastUsed: new Date() },
      where: { id: keyRecord.id },
    })
    .catch((error) =>
      appLogger.error({
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        keyId: keyRecord.id,
        msg: "Failed to update api key lastUsed",
      }),
    );

  return keyRecord;
}
