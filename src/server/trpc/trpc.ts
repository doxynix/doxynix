import { PrismaClient } from "@prisma/client";
import { initTRPC, TRPCError } from "@trpc/server";
import { enhance } from "@zenstackhq/runtime";
import superjson from "superjson";
import { OpenApiMeta } from "trpc-to-openapi";

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
  const sessionId = ctx.session?.user?.id;
  const userId = sessionId !== undefined && sessionId !== null ? Number(sessionId) : undefined;

  const protectedDb = enhance(ctx.prisma, {
    user: userId !== undefined ? { id: userId } : undefined,
  }) as unknown as PrismaClient;

  return next({
    ctx: {
      ...ctx,
      db: protectedDb,
    },
  });
});

const contextMiddleware = t.middleware(async ({ ctx, next }) => {
  return requestContext.run(ctx.requestInfo, () => next({ ctx }));
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure.use(contextMiddleware).use(withZenStack);

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
