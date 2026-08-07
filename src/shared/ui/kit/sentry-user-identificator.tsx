"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

import type { User } from "@/shared/lib/auth-client";
import { getClientCookie } from "@/shared/lib/cookies";

type Props = { user: User };

export function SentryUserIdentificator({ user }: Props) {
  useEffect(() => {
    Sentry.setUser({
      email: user.email,
      id: user.id,
      role: user.role,
      username: user.name,
    });

    const requestId = getClientCookie("last_request_id");
    if (requestId != null) {
      Sentry.setTag("request_id", requestId);
    }

    return () => {
      Sentry.setUser(null);
    };
  }, [user]);

  return null;
}
