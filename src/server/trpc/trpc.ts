import crypto from "crypto";
import { PrismaClient, UserRole } from "@prisma/client";
import { initTRPC, TRPCError } from "@trpc/server";
import { enhance } from "@zenstackhq/runtime";
import superjson from "superjson";
import { OpenApiMeta } from "trpc-to-openapi";

import { logger } from "@/shared/lib/logger";

import { Context } from "@/server/trpc/context";
import { requestContext } from "@/server/utils/requestContext";

export const t = initTRPC
  .context<Context>()
  .meta<OpenApiMeta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zodError: error.code === "BAD_REQUEST" ? error.cause : null,
        },
      };
    },
  });

const withZenStack = t.middleware(async ({ ctx, next }) => {
  const sessionUser = ctx.session?.user;
  const userId =
    sessionUser?.id !== undefined && sessionUser.id !== null ? Number(sessionUser.id) : undefined;

  const userRole =
    sessionUser?.role !== undefined && sessionUser?.role !== null
      ? (sessionUser.role as UserRole)
      : undefined;

  const protectedDb = enhance(ctx.prisma, {
    user: userId !== undefined ? { id: userId, role: userRole } : undefined,
  }) as unknown as PrismaClient;

  return next({
    ctx: {
      ...ctx,
      db: protectedDb,
    },
  });
});

const contextMiddleware = t.middleware(async ({ ctx, next, path, type }) => {
  const requestId = crypto.randomUUID();
  const sessionUser = ctx.session?.user;

  return requestContext.run(
    {
      requestId,
      userId:
        sessionUser?.id !== undefined && sessionUser?.id !== null
          ? Number(sessionUser.id)
          : undefined,
      userRole: sessionUser?.role,
      ip: ctx.requestInfo.ip,
      userAgent: ctx.requestInfo.userAgent,
      referer: ctx.req.headers.get("referer") ?? undefined,
      origin: ctx.req.headers.get("origin") ?? undefined,
      path,
      method: type,
    },
    () => next({ ctx })
  );
});

const loggerMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = performance.now();
  const result = await next();
  const durationMs = Number((performance.now() - start).toFixed(2));

  const meta = { path, type, durationMs };

  if (result.ok) {
    logger.info({ ...meta, msg: `tRPC [${type}] ok: ${path}` });
  } else {
    logger.error({
      ...meta,
      msg: `tRPC [${type}] error: ${path}`,
      code: result.error.code,
      message: result.error.message,
      stack: result.error.code === "INTERNAL_SERVER_ERROR" ? result.error.stack : undefined,
    });
    if (process.env.NODE_ENV === "production") {
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
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Вы не авторизованы" });
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
    throw new TRPCError({ code: "FORBIDDEN", message: "Нужны права админа" });
  }

  return next({ ctx });
});

export const adminProcedure = protectedProcedure.use(isAdmin);
