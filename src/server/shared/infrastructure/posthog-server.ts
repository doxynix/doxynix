import { PostHog } from "posthog-node";

import { env } from "@/shared/constants/env";

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog {
  if (posthogClient == null) {
    posthogClient = new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
      flushAt: 1,
      flushInterval: 0,
      host: env.NEXT_PUBLIC_POSTHOG_HOST,
    });
  }
  return posthogClient;
}
