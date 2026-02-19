"use client";

import React, { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import superjson from "superjson";

import { trpc } from "@/shared/api/trpc";
import { APP_URL, IS_DEV } from "@/shared/constants/env.client";
import { TooltipProvider } from "@/shared/ui/core/tooltip";
import { RealtimeProvider } from "@/features/notifications/realtime-provider";

type Props = {
  children: ReactNode;
};

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  return APP_URL;
}

export function Providers({ children }: Props) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
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
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
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
  <ThemeProvider
    attribute="class"
    defaultTheme="dark" // THEME: пока на время светлая тема удалена
    storageKey="doxynix-theme"
    enableSystem={false} // THEME: пока на время светлая тема удалена
    forcedTheme="dark" // THEME: пока на время светлая тема удалена
    disableTransitionOnChange
  >
    <TooltipProvider>{children}</TooltipProvider>
  </ThemeProvider>
);
