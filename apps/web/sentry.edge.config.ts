import * as Sentry from "@sentry/nextjs";

import { SENTRY_DSN } from "@/shared/config/env.client";
import { IS_PROD } from "@/shared/config/env.flags";
import { SENTRY_DATA_COLLECTION } from "@/shared/config/sentry";

Sentry.init({
  dataCollection: SENTRY_DATA_COLLECTION,
  dsn: SENTRY_DSN,
  enabled: IS_PROD,

  enableLogs: true,

  tracesSampleRate: 0.1,
});
