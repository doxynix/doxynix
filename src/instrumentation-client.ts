import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

import {
  API_PREFIX,
  IS_DEV,
  IS_PROD,
  NEXT_PUBLIC_POSTHOG_KEY,
  SENTRY_DSN,
  TRPC_PREFIX,
} from "./shared/constants/env.client";

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

  replaysOnErrorSampleRate: 1.0,

  replaysSessionSampleRate: 0.01,

  sendDefaultPii: false,

  tracesSampleRate: 0.1,

  tunnel: `${API_PREFIX}/dxnx/s`,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

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
