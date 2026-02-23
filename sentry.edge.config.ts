import * as Sentry from "@sentry/nextjs";

import { IS_PROD, SENTRY_DSN } from "@/shared/constants/env.client";

Sentry.init({
  dsn: SENTRY_DSN,

  sendDefaultPii: false,

  tracesSampleRate: IS_PROD ? 0.1 : 1.0,
});
