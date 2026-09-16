import * as Sentry from "@sentry/nextjs";

import { SENTRY_DSN } from "@/shared/config/env.client";
import { IS_PROD } from "@/shared/config/env.flags";

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: IS_PROD,

  enableLogs: true,

  sendDefaultPii: false,

  tracesSampleRate: 0.1,
});
