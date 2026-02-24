import crypto from "node:crypto";
import type { UserRole } from "@prisma/client";
import { initTRPC, TRPCError } from "@trpc/server";
import { enhance } from "@zenstackhq/runtime";
import superjson from "superjson";
import type { OpenApiMeta } from "trpc-to-openapi";

import { IS_PROD } from "@/shared/constants/env.client";

import type { Context } from "@/server/trpc/context";
import { requestContext } from "@/server/utils/request-context";

import type { DbClient } from "../db/db";
import { logger } from "../logger/logger";

export const t = initTRPC
  .context<Context>()
  .meta<OpenApiMeta>()
  .create({
    errorFormatter({ ctx, error, shape }) {
      const publicErrors = [
        "BAD_REQUEST",
        "CONFLICT",
        "UNAUTHORIZED",
        "FORBIDDEN",
        "TOO_MANY_REQUESTS",
        "NOT_FOUND",
      ];

      const isPublicError = publicErrors.includes(error.code);

      return {
        ...shape,
        data: {
          ...shape.data,
          requestId: requestContext.getStore()?.requestId ?? ctx?.req.headers.get("x-request-id"),
          stack: IS_PROD ? undefined : error.stack,
          zodError: error.code === "BAD_REQUEST" ? error.cause : null,
        },
        message:
          IS_PROD && !isPublicError
            ? "An unexpected error occurred, please try again later."
            : error.message,
      };
    },
    transformer: superjson,
  });

const withZenStack = t.middleware(async ({ ctx, next }) => {
  const sessionUser = ctx.session?.user;
  const userId = sessionUser == null ? undefined : Number(sessionUser.id);

  const userRole = sessionUser?.role == null ? undefined : (sessionUser.role as UserRole);

  const protectedDb = enhance(ctx.prisma, {
    user: userId == null ? undefined : { id: userId, role: userRole },
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
      userId: sessionUser?.id == null ? undefined : Number(sessionUser.id),
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
  if (ctx.session?.user == null) {
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
  if (ctx.session?.user.role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin rights required" });
  }

  return next({ ctx });
});

export const adminProcedure = protectedProcedure.use(isAdmin);
