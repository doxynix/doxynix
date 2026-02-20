import * as Sentry from "@sentry/nextjs";

import { IS_PROD, SENTRY_DSN } from "@/shared/constants/env.client";

Sentry.init({
  dsn: SENTRY_DSN,

  tracesSampleRate: IS_PROD ? 0.1 : 1.0,

  enableLogs: true,

  sendDefaultPii: false,

  replaysSessionSampleRate: 0.1,

  replaysOnErrorSampleRate: 1.0,
});
