import { auth } from "@server/core/auth";
import { rolesEnum } from "@server/core/db/schema";
import type { MiddlewareHandler } from "hono";

export type Role = (typeof rolesEnum.enumValues)[number];

export type AuthUser = typeof auth.$Infer.Session.user & {
  role: Role;
};

export type AuthSession = typeof auth.$Infer.Session.session;

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

function isValidAuthUser(user: typeof auth.$Infer.Session.user): user is AuthUser {
  return (
    typeof user.role === "string" &&
    rolesEnum.enumValues.some((validRole) => validRole === user.role)
  );
}

export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const sessionData = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (sessionData == null || !isValidAuthUser(sessionData.user)) {
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

export function requireRole(...allowedRoles: Role[]): MiddlewareHandler<AuthEnv> {
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
