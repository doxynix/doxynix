import * as Sentry from "@sentry/nextjs";

import { API_PREFIX, IS_PROD, SENTRY_DSN, TRPC_PREFIX } from "./shared/constants/env.client";

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

Sentry.init({
  dsn: SENTRY_DSN,

  integrations: IS_PROD
    ? [
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
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
      ]
    : [Sentry.browserTracingIntegration()],

  tracesSampleRate: IS_PROD ? 0.1 : 1.0,
  enableLogs: !IS_PROD,

  replaysSessionSampleRate: IS_PROD ? 0.01 : 0,

  replaysOnErrorSampleRate: IS_PROD ? 1.0 : 0.0,

  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
