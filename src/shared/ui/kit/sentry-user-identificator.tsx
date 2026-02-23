"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Cookies from "js-cookie";
import type { User } from "next-auth";

type Props = { user: User };

export function SentryUserIdentificator({ user }: Props) {
  useEffect(() => {
    if (user) {
      Sentry.setUser({
        email: user.email ?? undefined,
        id: user.id,
        role: user.role ?? undefined,
        username: user.name ?? undefined,
      });
    }

    const requestId = Cookies.get("last_request_id");
    if (requestId) {
      Sentry.setTag("request_id", requestId);
    }

    return () => {
      Sentry.setUser(null);
    };
  }, [user]);

  return null;
}
