import { PostHog } from "posthog-node";

import { NEXT_PUBLIC_POSTHOG_HOST, NEXT_PUBLIC_POSTHOG_KEY } from "@/shared/constants/env.client";

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog {
  if (posthogClient == null) {
    posthogClient = new PostHog(NEXT_PUBLIC_POSTHOG_KEY, {
      flushAt: 1,
      flushInterval: 0,
      host: NEXT_PUBLIC_POSTHOG_HOST,
    });
  }
  return posthogClient;
}
