import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { NextRequest } from "next/server";

import { IS_DEV, TRPC_PREFIX } from "@/shared/constants/env.client";

import { createContext } from "./context";
import { appRouter } from "./router";
import { createCallerFactory } from "./trpc";

const caller = createCallerFactory(appRouter);

export const api = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");

  const protocol = IS_DEV ? "http" : "https";
  const host = heads.get("host") ?? "localhost:3000";

  const ctx = await createContext({
    req: new NextRequest(`${protocol}://${host}${TRPC_PREFIX}`, { headers: heads }),
  });

  return caller(ctx);
});
