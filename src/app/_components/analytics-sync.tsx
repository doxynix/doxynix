"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";

export function AnalyticsSync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated" && session.user.id) {
      const userId = session.user.id;

      posthog.identify(userId, {
        name: session.user.name ?? undefined,
      });

      Sentry.setUser({
        id: userId,
        username: session.user.name ?? undefined,
      });

      const sessionId = posthog.get_session_id();
      if (sessionId) {
        Sentry.setTag("posthog_session_id", sessionId);
      }
    }

    if (status === "unauthenticated") {
      posthog.reset();
      Sentry.setUser(null);
    }
  }, [session, status]);

  return null;
}
