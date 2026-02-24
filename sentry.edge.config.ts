import * as Sentry from "@sentry/nextjs";

import { IS_PROD, SENTRY_DSN } from "@/shared/constants/env.client";

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: IS_PROD,

  sendDefaultPii: false,

  tracesSampleRate: 0.1,
});
