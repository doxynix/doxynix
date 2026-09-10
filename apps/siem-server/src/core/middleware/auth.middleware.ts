import { createMiddleware } from "hono/factory";

import { auth } from "@/core/auth/auth";
import type { AuthSession, AuthUser, UserRole } from "@/core/auth/auth.types";

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser | undefined;
    session: AuthSession | undefined;
  }
}

export const requireAuth = createMiddleware(async (c, next) => {
  const sessionData = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (sessionData == null) {
    return c.json(
      {
        error: "Unauthorized",
        success: false,
      },
      401,
    );
  }

  c.set("user", sessionData.user);
  c.set("session", sessionData.session);

  return next();
});

export function requireRole(...allowedRoles: UserRole[]) {
  return createMiddleware(async (c, next) => {
    const user = c.get("user");

    if (user == null) {
      return c.json(
        {
          error: "Unauthorized",
          success: false,
        },
        401,
      );
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json(
        {
          error: "Forbidden",
          success: false,
        },
        403,
      );
    }

    return next();
  });
}
