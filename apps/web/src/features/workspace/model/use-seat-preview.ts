"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/shared/api/trpc";

// Only while the dialog is open: the price needs a Stripe read, and the members list must not wait
// for it on every render.
export function useSeatPreview(enabled: boolean) {
  const trpc = useTRPC();

  return useQuery(trpc.workspace.seatPreview.queryOptions(undefined, { enabled }));
}
