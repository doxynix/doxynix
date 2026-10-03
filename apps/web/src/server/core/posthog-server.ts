import { PostHog } from "posthog-node";

import { IS_PROD } from "@/shared/config/env.flags";
import { POSTHOG_API_KEY, POSTHOG_HOST } from "@/shared/config/env.server";

let posthogClient: null | PostHog = null;

// Events here are low-frequency and reliability-critical, so each one gets its own request.
// Batching would need a `shutdown()` call wired to the Vercel `after()` hook to avoid drops.
function createClient(): PostHog {
  return new PostHog(POSTHOG_API_KEY ?? "", {
    flushAt: 1,
    flushInterval: 0,
    host: POSTHOG_HOST ?? "https://us.i.posthog.com",
  });
}

export function isPostHogServerEnabled(): boolean {
  return IS_PROD && POSTHOG_API_KEY != null && POSTHOG_API_KEY.length > 0;
}

export function captureServerEvent(
  event: string,
  properties: Record<string, unknown> = {},
  distinctId?: string,
): void {
  if (!isPostHogServerEnabled()) {
    return;
  }

  posthogClient ??= createClient();
  posthogClient.capture({ distinctId, event, properties });
}

export async function shutdownPostHogServer(): Promise<void> {
  await posthogClient?.shutdown();
  posthogClient = null;
}
