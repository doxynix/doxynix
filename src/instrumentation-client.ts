import * as Sentry from "@sentry/nextjs";

import { API_PREFIX, IS_PROD, SENTRY_DSN, TRPC_PREFIX } from "./shared/constants/env.client";

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

  tunnel: "/api/v1/dxnx",
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
