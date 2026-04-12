"use client";

import React, { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { SessionProvider } from "next-auth/react";
import { useTheme } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import superjson from "superjson";

import { trpc } from "@/shared/api/trpc";
import { APP_URL, IS_DEV, TRPC_PREFIX } from "@/shared/constants/env.client";
import { setClientCookie } from "@/shared/lib/utils";
import { TooltipProvider } from "@/shared/ui/core/tooltip";

import { AnalyticsSync } from "./_components/analytics-sync";
import { RealtimeProvider } from "./_components/realtime-provider";

type Props = {
  children: ReactNode;
};

function getBaseUrl() {
  if (typeof globalThis.window !== "undefined") return "";
  return APP_URL;
}

export function Providers({ children }: Readonly<Props>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30_000,
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        loggerLink({
          enabled: (opts) => IS_DEV || (opts.direction === "down" && opts.result instanceof Error),
        }),
        httpBatchLink({
          transformer: superjson,
          url: `${getBaseUrl()}${TRPC_PREFIX}`,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <RealtimeProvider>
            <InnerProviders>{children}</InnerProviders>
          </RealtimeProvider>
        </SessionProvider>
        {IS_DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

const InnerProviders = ({ children }: { children: ReactNode }) => (
  <TooltipProvider>
    <ThemeCookieSync />
    <AnalyticsSync />
    <NuqsAdapter>{children}</NuqsAdapter>
  </TooltipProvider>
);

function ThemeCookieSync() {
  const { theme } = useTheme();

  React.useEffect(() => {
    if (theme == null) return;

    setClientCookie("doxynix-theme", theme, 31_536_000);
  }, [theme]);

  return null;
}
