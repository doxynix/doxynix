import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { OpenApiMeta } from "trpc-to-openapi";

import { Context } from "@/server/trpc/context";

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

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

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

export const protectedProcedure = t.procedure.use(isAuthed);

const isAdmin = t.middleware(({ ctx, next }) => {
  if (ctx.session?.user == null || ctx.session.user.role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Нужны права админа" });
  }

  return next({ ctx });
});

export const adminProcedure = protectedProcedure.use(isAdmin);
