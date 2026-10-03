import { captureServerEvent } from "@/server/core/posthog-server";
import { requestContext } from "@/server/utils/request-context";

export type ServerAnalyticsEvent =
  | "fix_generated"
  | "fix_generation_failed"
  | "pr_analysis_completed"
  | "pr_analysis_failed"
  | "repo_analysis_completed"
  | "repo_analysis_failed"
  | "repo_analysis_queued"
  | "repo_analysis_skipped";

// Trigger.dev tasks run outside any HTTP request, so `requestContext` is empty there and the
// caller must pass the payload's `userId`. tRPC procedures and route handlers get it for free.
export function resolveDistinctId(explicit?: string): string | undefined {
  return explicit ?? requestContext.getStore()?.userId;
}

export function trackServerEvent(
  event: ServerAnalyticsEvent,
  properties: Record<string, unknown> = {},
  distinctId?: string,
): void {
  captureServerEvent(event, properties, resolveDistinctId(distinctId));
}
