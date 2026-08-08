import * as Sentry from "@sentry/nextjs";

import { SENTRY_DSN } from "@/shared/constants/env.client";
import { IS_PROD } from "@/shared/constants/env.flags";

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: IS_PROD,

  sendDefaultPii: false,

  tracesSampleRate: 0.1,
});
