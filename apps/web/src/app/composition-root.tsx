"use client";

import { type ReactNode, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { LucideProvider } from "lucide-react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import superjson from "superjson";

import { makeQueryClient } from "@/shared/api/query-client";
import { TRPCProvider } from "@/shared/api/trpc";
import { APP_URL, TRPC_PREFIX } from "@/shared/config/env.client";
import { IS_DEV } from "@/shared/config/env.flags";
import { getWorkspaceCookie, WS_HEADER } from "@/shared/lib/workspace-cookie";
import { TooltipProvider } from "@/shared/ui/core/tooltip";

import type { AppRouter } from "@/server/modules";

import { AnalyticsSync } from "./_components/analytics-sync";
import { RealtimeProvider } from "./_components/realtime-provider";

type Props = {
  children: ReactNode;
};

function getBaseUrl() {
  if (typeof globalThis.window !== "undefined") {
    return "";
  }
  return APP_URL;
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  } else {
    browserQueryClient ??= makeQueryClient();
    return browserQueryClient;
  }
}

export function Providers({ children }: Readonly<Props>) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (opts) => IS_DEV || (opts.direction === "down" && opts.result instanceof Error),
        }),
        httpBatchLink({
          headers: () => {
            const workspaceId = getWorkspaceCookie();

            return workspaceId == null ? {} : { [WS_HEADER]: workspaceId };
          },
          transformer: superjson,
          url: `${getBaseUrl()}${TRPC_PREFIX}`,
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider
        queryClient={queryClient}
        trpcClient={trpcClient}
      >
        <RealtimeProvider>
          <InnerProviders>{children}</InnerProviders>
        </RealtimeProvider>
        {IS_DEV && (
          <ReactQueryDevtools
            initialIsOpen={false}
            theme="dark"
          />
        )}
      </TRPCProvider>
    </QueryClientProvider>
  );
}

const InnerProviders = ({ children }: { children: ReactNode }) => (
  <TooltipProvider>
    <LucideProvider
      className="shrink-0 select-none"
      nonScalingStroke
      size={16}
      strokeWidth={1.5}
    >
      <AnalyticsSync />
      <NuqsAdapter>{children}</NuqsAdapter>
    </LucideProvider>
  </TooltipProvider>
);
