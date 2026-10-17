import { auth } from "@/server/core/auth";
import { verifyAndUseApiKey } from "@/server/core/auth/verify-api-key";

// Mirrors the tRPC context's order: an explicit bearer credential wins over an ambient cookie session.
export async function resolveRequestUserId(headers: Headers): Promise<null | string> {
  const authHeader = headers.get("authorization");

  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();

    if (token.length > 0) {
      const keyRecord = await verifyAndUseApiKey(token);

      if (keyRecord != null) {
        return keyRecord.user.id;
      }
    }
  }

  const session = await auth.api.getSession({ headers });

  return session?.user.id ?? null;
}
