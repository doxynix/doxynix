import { auth } from "@server/core/auth/auth";
import type { AuthSession, AuthUser, UserRole } from "@server/core/auth/auth.types";
import type { MiddlewareHandler } from "hono";

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
    session: AuthSession;
  }
}

export type AuthEnv = {
  Variables: {
    user: AuthUser;
    session: AuthSession;
  };
};

export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const sessionData = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (sessionData == null) {
    return c.json(
      {
        success: false,
        error: "Unauthorized",
      },
      401,
    );
  }

  c.set("user", sessionData.user);
  c.set("session", sessionData.session);

  return await next();
};

export function requireRole(...allowedRoles: UserRole[]): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const user = c.get("user");

    if (user == null) {
      return c.json(
        {
          success: false,
          error: "Unauthorized",
        },
        401,
      );
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json(
        {
          success: false,
          error: "Forbidden",
        },
        403,
      );
    }

    return await next();
  };
}
