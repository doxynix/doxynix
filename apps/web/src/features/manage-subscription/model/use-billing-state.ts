"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/shared/api/trpc";

export function useBillingState() {
  const trpc = useTRPC();

  return useQuery(trpc.billing.getState.queryOptions());
}
