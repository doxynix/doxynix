import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { createContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/router";
import { createCallerFactory } from "@/server/trpc/trpc";

const caller = createCallerFactory(appRouter);

export const api = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");

  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  const host = heads.get("host") != null || "localhost:3000";

  const ctx = await createContext({
    req: new Request(`${protocol}://${host}/api/trpc`, { headers: heads }),
  });

  return caller(ctx);
});
