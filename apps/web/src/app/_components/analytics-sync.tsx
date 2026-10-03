"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

import { authClient } from "@/shared/lib/auth-client";
import { getClientSessionId, identifyUser } from "@/shared/lib/posthog-client";

export function AnalyticsSync() {
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending) {
      return;
    }

    const user = session?.user;
    if (user?.id != null) {
      identifyUser({
        createdAt: user.createdAt,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
        userId: String(user.id),
      });

      Sentry.setUser({
        id: String(user.id),
        username: user.name,
      });

      const sessionId = getClientSessionId();
      if (sessionId) {
        Sentry.setTag("posthog_session_id", sessionId);
      }
    } else {
      identifyUser(null);
      Sentry.setUser(null);
    }
  }, [session, isPending]);

  return null;
}
