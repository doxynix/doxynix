import { appLogger } from "@/server/core/app-logger";
import { prisma, runAsBackgroundTask } from "@/server/core/db";
import { extractPayloadFromKey, getApiKeyHash, validateApiKeyChecksum } from "@/server/utils/hash";

// Every API request used to write `lastUsed`; hour-level granularity is enough for the UI and
// keeps a CI pipeline from turning each call into a row update plus WAL traffic.
const LAST_USED_REFRESH_MS = 60 * 60 * 1000;

function retireExpiredKey(keyId: string, msg: string) {
  void runAsBackgroundTask(async () => {
    try {
      await prisma.apiKey.update({ data: { revoked: true }, where: { id: keyId } });
    } catch (error) {
      appLogger.error({
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        keyId,
        msg,
      });
    }
  });
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

  const lastUsedAt = keyRecord.lastUsed?.getTime() ?? 0;

  if (now - lastUsedAt > LAST_USED_REFRESH_MS) {
    void runAsBackgroundTask(async () => {
      await prisma.apiKey.updateMany({
        data: { lastUsed: new Date() },
        where: { id: keyRecord.id },
      });
    });
  }

  return keyRecord;
}
