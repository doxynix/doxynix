import * as Sentry from "@sentry/nextjs";

import { IS_PROD, SENTRY_DSN } from "./shared/constants/env.client";

Sentry.init({
  dsn: SENTRY_DSN,

  integrations: IS_PROD
    ? [
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
        Sentry.httpClientIntegration({
          failedRequestTargets: ["/api/trpc", "/api/v1"],
        }),
        Sentry.reportingObserverIntegration({
          types: ["crash", "deprecation", "intervention"],
        }),
      ]
    : [],

  tracesSampleRate: IS_PROD ? 0.1 : 1.0,
  enableLogs: true,

  replaysSessionSampleRate: IS_PROD ? 0.01 : 0,

  replaysOnErrorSampleRate: 1.0,

  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
