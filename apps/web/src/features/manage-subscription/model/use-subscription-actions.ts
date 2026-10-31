"use client";

import { useMutation } from "@tanstack/react-query";

import { useTRPC } from "@/shared/api/trpc";

export function useSubscriptionActions() {
  const trpc = useTRPC();

  const checkout = useMutation(
    trpc.billing.createCheckout.mutationOptions({
      // Hosted Checkout owns the payment UI; the URL is used once and never stored or logged.
      onSuccess: ({ url }) => {
        if (url != null) {
          window.location.assign(url);
        }
      },
    }),
  );

  const portal = useMutation(
    trpc.billing.createPortalSession.mutationOptions({
      onSuccess: ({ url }) => {
        window.location.assign(url);
      },
    }),
  );

  return { checkout, portal };
}
