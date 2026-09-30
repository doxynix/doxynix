import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { extractPayloadFromKey, getApiKeyHash, validateApiKeyChecksum } from "@/server/utils/hash";

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

  if (keyRecord.revoked) {
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
