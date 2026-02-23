import crypto from "node:crypto";
import type { UserRole } from "@prisma/client";
import { initTRPC, TRPCError } from "@trpc/server";
import { enhance } from "@zenstackhq/runtime";
import superjson from "superjson";
import type { OpenApiMeta } from "trpc-to-openapi";

import type { DbClient } from "@/shared/api/db/db";
import { IS_PROD } from "@/shared/constants/env.client";
import { logger } from "@/shared/lib/logger";

import type { Context } from "@/server/trpc/context";
import { requestContext } from "@/server/utils/request-context";

export const t = initTRPC
  .context<Context>()
  .meta<OpenApiMeta>()
  .create({
    errorFormatter({ ctx, error, shape }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          requestId: requestContext.getStore()?.requestId ?? ctx?.req.headers.get("x-request-id"),
          zodError: error.code === "BAD_REQUEST" ? error.cause : null,
        },
      };
    },
    transformer: superjson,
  });

const withZenStack = t.middleware(async ({ ctx, next }) => {
  const sessionUser = ctx.session?.user;
  const userId = sessionUser != null ? Number(sessionUser.id) : undefined;

  const userRole = sessionUser?.role != null ? (sessionUser.role as UserRole) : undefined;

  const protectedDb = enhance(ctx.prisma, {
    user: userId != null ? { id: userId, role: userRole } : undefined,
  }) as unknown as DbClient;

  return next({
    ctx: {
      ...ctx,
      db: protectedDb,
    },
  });
});

const contextMiddleware = t.middleware(async ({ ctx, next, path, type }) => {
  const requestId = ctx.req.headers.get("x-request-id") ?? crypto.randomUUID();
  const sessionUser = ctx.session?.user;

  return requestContext.run(
    {
      ip: ctx.requestInfo.ip,
      method: type,
      origin: ctx.req.headers.get("origin") ?? undefined,
      path,
      referer: ctx.req.headers.get("referer") ?? undefined,
      requestId,
      userAgent: ctx.requestInfo.userAgent,
      userId: sessionUser?.id != null ? Number(sessionUser.id) : undefined,
      userRole: sessionUser?.role,
    },
    () => next({ ctx })
  );
});

const loggerMiddleware = t.middleware(async ({ next, path, type }) => {
  const start = performance.now();
  const result = await next();
  const durationMs = Number((performance.now() - start).toFixed(2));

  const meta = { durationMs, path, type };

  if (result.ok) {
    logger.info({ ...meta, msg: `tRPC [${type}] ok: ${path}` });
  } else {
    logger.error({
      ...meta,
      code: result.error.code,
      message: result.error.message,
      msg: `tRPC [${type}] error: ${path}`,
      stack: result.error.code === "INTERNAL_SERVER_ERROR" ? result.error.stack : undefined,
    });
    if (IS_PROD) {
      await logger.flush();
    }
  }
  return result;
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure
  .use(contextMiddleware)
  .use(loggerMiddleware)
  .use(withZenStack);

const isAuthed = t.middleware(({ ctx, next }) => {
  if (ctx.session == null || ctx.session.user == null) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "You are not logged in" });
  }

  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

export const protectedProcedure = publicProcedure.use(isAuthed);

const isAdmin = t.middleware(({ ctx, next }) => {
  if (ctx.session?.user == null || ctx.session.user.role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin rights required" });
  }

  return next({ ctx });
});

export const adminProcedure = protectedProcedure.use(isAdmin);
