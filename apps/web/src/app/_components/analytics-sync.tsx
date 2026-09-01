"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

import { authClient } from "@/shared/lib/auth-client";

export function AnalyticsSync() {
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (session?.user.id != null) {
      const userId = String(session.user.id);

      posthog.identify(userId, {
        name: session.user.name,
      });

      Sentry.setUser({
        id: userId,
        username: session.user.name,
      });

      const sessionId = posthog.get_session_id();
      if (sessionId) {
        Sentry.setTag("posthog_session_id", sessionId);
      }
    } else {
      posthog.reset();
      Sentry.setUser(null);
    }
  }, [session, isPending]);

  return null;
}
