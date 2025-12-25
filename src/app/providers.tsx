"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

import type { ProvidersProps } from "./types";

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" storageKey="theme" enableSystem>
      <SessionProvider>{children}</SessionProvider>
    </ThemeProvider>
  );
}
