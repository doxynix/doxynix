/**
 * @fileoverview Client-side instrumentation setup for Sentry and PostHog.
 * This module handles the initialization of error tracking and analytics services
 * for the browser environment.
 */

import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import {
  API_PREFIX,
  NEXT_PUBLIC_POSTHOG_KEY,
  SENTRY_DSN,
  TRPC_PREFIX,
} from "./shared/constants/env.client";
import { IS_DEV, IS_PROD } from "./shared/constants/env.flags";

/**
 * Escapes special characters in a string for use in a regular expression.
 *
 * @param {string} str - The raw string to escape.
 * @returns {string} The escaped string safe for RegExp construction.
 */
function escapeRegExp(str: string) {
  return str.replaceAll(/[$()*+.?[\\\\\\]^{|}]/g, String.raw`\\$&`);
}

/**
 * Initializes Sentry for client-side error tracking and performance monitoring.
 * Configures integrations for session replays, HTTP client monitoring, and browser tracing.
 */
Sentry.init({
  dsn: SENTRY_DSN,
  enabled: IS_PROD,
  enableLogs: !IS_PROD,
  integrations: IS_PROD
    ? [
        Sentry.replayIntegration({
          blockAllMedia: true,
          maskAllText: true,
        }),
        Sentry.httpClientIntegration({
          failedRequestTargets: [
            new RegExp(`^${escapeRegExp(TRPC_PREFIX)}`),
            new RegExp(`^${escapeRegExp(API_PREFIX)}`),
          ],
        }),
        Sentry.reportingObserverIntegration({
          types: ["crash", "deprecation", "intervention"],
        }),
        Sentry.browserTracingIntegration(),
      ]
    : [Sentry.browserTracingIntegration()],
  replaysOnErrorSampleRate: 1,
  replaysSessionSampleRate: 0.01,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  tunnel: `${API_PREFIX}/dxnx/s`,
});

/**
 * Captures the start of a router transition for Sentry performance monitoring.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

/**
 * Initializes PostHog for client-side analytics.
 * Only active in production environments with session recording disabled.
 */
if (IS_PROD) {
  posthog.init(NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: `${API_PREFIX}/dxnx/p`,
    capture_exceptions: false,
    debug: IS_DEV,
    defaults: "2026-01-30",
    disable_session_recording: true,
    ui_host: "https://us.posthog.com",
  });
}
