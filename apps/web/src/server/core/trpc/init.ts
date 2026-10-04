import type { UserRole } from "@doxynix/shared";
import { initTRPC, TRPCError } from "@trpc/server";
import { enhance } from "@zenstackhq/runtime";
import superjson from "superjson";

import { IS_PROD } from "@/shared/config/env.flags";

import { normalizeError } from "@/server/core/api-error";
import {
  buildRequestStore,
  requestContext,
  resolveRequestId,
  withProcedureContext,
} from "@/server/utils/request-context";

import { appLogger } from "../app-logger";
import type { DbClient } from "../db";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  // tRPC hardcodes `INTERNAL_SERVER_ERROR` for any non-`TRPCError` throw and parks the original on `cause`, so re-normalizing `cause` here covers every unwrapped Prisma/Zod/`AppError`; writing `data.httpStatus` is what makes the re-mapped code reach the wire, since `getErrorShape` seeds that field from the pre-normalization error.
  errorFormatter({ ctx, error, shape }) {
    const requestId =
      requestContext.getStore()?.requestId ?? resolveRequestId(ctx?.req) ?? "unknown";

    const normalized = normalizeError(error.cause ?? error);

    return {
      ...shape,
      data: {
        ...shape.data,
        code: normalized.code,
        httpStatus: normalized.status,
        requestId,
        stack: IS_PROD ? undefined : error.stack,
        zodError: normalized.code === "BAD_REQUEST" ? (normalized.zodIssues ?? null) : null,
      },
      message: normalized.clientMessage(),
    };
  },
  transformer: superjson,
});

const withZenStack = t.middleware(async ({ ctx, next }) => {
  const sessionUser = ctx.session?.user;
  const userId = sessionUser?.id;
  const userRole = sessionUser?.role == null ? undefined : (sessionUser.role as UserRole);

  // `enhance`'s declared return type is already assignable to `DbClient`; a `satisfies` keeps it honest without widening by assertion.
  const protectedDb = enhance(ctx.prisma, {
    user: userId == null ? undefined : { id: userId, role: userRole },
  }) satisfies DbClient;

  return next({
    ctx: {
      ...ctx,
      db: protectedDb,
    },
  });
});

const contextMiddleware = t.middleware(async ({ ctx, next, path, type }) => {
  const sessionUser = ctx.session?.user;
  const activeStore = requestContext.getStore();

  if (activeStore) {
    return withProcedureContext(
      activeStore,
      {
        method: type,
        path,
        userId: sessionUser?.id,
        userRole: sessionUser?.role,
      },
      () => next({ ctx }),
    );
  }

  const store = buildRequestStore({
    method: type,
    path,
    req: ctx.req,
    userId: sessionUser?.id,
    userRole: sessionUser?.role,
  });

  return requestContext.run(store, () => next({ ctx }));
});

const loggerMiddleware = t.middleware(async ({ next, path, type }) => {
  const start = performance.now();
  const result = await next();
  const durationMs = Number((performance.now() - start).toFixed(2));

  const meta = { durationMs, path, type };

  if (result.ok) {
    appLogger.info({ ...meta, msg: `tRPC [${type}] ok: ${path}` });
    return result;
  }

  // Normalized the same way `errorFormatter` does, so the log line and the client's response always report the same code.
  const normalized = normalizeError(result.error.cause ?? result.error);
  const logMeta = {
    ...meta,
    code: normalized.code,
    kind: normalized.kind,
    message: result.error.message,
    source: normalized.source,
  };

  if (normalized.isUnexpected) {
    appLogger.error({
      ...logMeta,
      error: result.error,
      msg: `tRPC [${type}] error: ${path}`,
      stack: normalized.code === "INTERNAL_SERVER_ERROR" ? result.error.stack : undefined,
    });

    if (IS_PROD) {
      await appLogger.flush();
    }

    return result;
  }

  // An expected 4xx is not an incident; logging it at `error` trained everyone to ignore the channel. `withApiHandler` splits the same way.
  appLogger.warn({ ...logMeta, msg: `tRPC [${type}] rejected: ${path}` });

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
