import "server-only";

import type { ReactNode } from "react";
import { cache } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { TRPCQueryKeyWithoutPrefix } from "@trpc/tanstack-react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import { makeQueryClient } from "@/shared/api/query-client";

import { appRouter } from "@/server/modules";

import { appLogger } from "../app-logger";
import { ctxForRequest } from "./server";

export const getQueryClient = cache(makeQueryClient);

export const trpcProxy = createTRPCOptionsProxy({
  ctx: ctxForRequest,
  queryClient: getQueryClient,
  router: appRouter,
});

export function HydrateClient({ children }: Readonly<{ children: ReactNode }>) {
  return <HydrationBoundary state={dehydrate(getQueryClient())}>{children}</HydrationBoundary>;
}

export function prefetch(queryOptions: { queryFn?: unknown; queryKey: TRPCQueryKeyWithoutPrefix }) {
  const queryClient = getQueryClient();

  const path = Array.isArray(queryOptions.queryKey[0])
    ? queryOptions.queryKey[0].join(".")
    : "<unknown>";

  const onRejected = (error: unknown) => {
    appLogger.warn({ error, msg: "tRPC prefetch failed", path });
    return undefined;
  };

  if (queryOptions.queryKey[1]?.type === "infinite") {
    return queryClient.infiniteQuery(queryOptions as never).catch(onRejected);
  }
  return queryClient.query(queryOptions as never).catch(onRejected);
}
