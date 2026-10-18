import type { ApiKeyScope } from "@doxynix/shared";

import { auth } from "@/server/core/auth";
import { hasApiKeyScope } from "@/server/core/auth/api-key-scopes";
import { verifyAndUseApiKey } from "@/server/core/auth/verify-api-key";

// Mirrors the tRPC context's order: an explicit bearer credential wins over an ambient cookie session.
// `requiredScope` guards the bearer branch only; a cookie session is already bound to a user and skips it.
export async function resolveRequestUserId(
  headers: Headers,
  requiredScope: ApiKeyScope,
): Promise<null | string> {
  const authHeader = headers.get("authorization");

  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();

    if (token.length > 0) {
      const keyRecord = await verifyAndUseApiKey(token);

      if (keyRecord != null) {
        return hasApiKeyScope(keyRecord.scopes, requiredScope) ? keyRecord.user.id : null;
      }
    }
  }

  const session = await auth.api.getSession({ headers });

  return session?.user.id ?? null;
}
