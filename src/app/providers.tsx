"use client";

import { SessionProvider } from "next-auth/react";

import type { ProvidersProps } from "./types";

export function Providers({ children }: ProvidersProps) {
  return <SessionProvider>{children}</SessionProvider>;
}
